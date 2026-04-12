// 番茄钟计时器 - 后台服务脚本

// 初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('番茄钟计时器已安装');
});

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startTimer') {
    startProgressBar(message.totalMinutes);
    sendResponse({ success: true });
  } else if (message.action === 'stopTimer') {
    stopProgressBar();
    sendResponse({ success: true });
  }
  return true;
});

// 监听闹钟
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pomodoroTimer') {
    timerFinished();
  }
});

// 计时结束处理
async function timerFinished() {
  // 发送通知
  await chrome.notifications.create('pomodoroComplete', {
    type: 'basic',
    iconUrl: 'icon128.png',
    title: '番茄钟计时器',
    message: '时间到，休息一会吧~',
    priority: 2,
    requireInteraction: true
  });

  // 清理状态
  await chrome.storage.local.remove(['timerState']);

  // 停止所有进度条
  await stopProgressBar();
}

// 启动进度条 - 向所有标签页注入内容脚本
async function startProgressBar(totalMinutes) {
  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    // 跳过chrome扩展页面和特殊页面
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('devtools://')) {
      continue;
    }

    try {
      // 注入内容脚本
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectProgressBar,
        args: [totalMinutes]
      });
    } catch (error) {
      console.log(`无法向标签页 ${tab.id} 注入脚本:`, error);
    }
  }
}

// 停止所有进度条
async function stopProgressBar() {
  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('devtools://')) {
      continue;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: removeProgressBar
      });
    } catch (error) {
      console.log(`无法从标签页 ${tab.id} 移除进度条:`, error);
    }
  }
}

// 监听新标签页创建，自动注入进度条
chrome.tabs.onCreated.addListener(async (tab) => {
  const state = await chrome.storage.local.get(['timerState']);
  if (state.timerState && state.timerState.isRunning) {
    // 等待页面加载完成
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);

        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('devtools://')) {
          return;
        }

        // 计算剩余时间
        const remainingMs = Math.max(0, state.timerState.endTime - Date.now());
        const remainingMinutes = remainingMs / 60000;
        const totalMinutes = state.timerState.totalMinutes;

        try {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: injectProgressBar,
            args: [totalMinutes, remainingMinutes]
          });
        } catch (error) {
          console.log(`无法向新标签页 ${tab.id} 注入脚本:`, error);
        }
      }
    });
  }
});

// 监听标签页更新，如果进度条丢失则重新注入
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const state = await chrome.storage.local.get(['timerState']);
    if (state.timerState && state.timerState.isRunning) {
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('devtools://')) {
        return;
      }

      // 检查是否已有进度条
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => !!document.getElementById('pomodoro-progress-bar')
        });

        if (results && results[0] && !results[0].result) {
          // 没有进度条，重新注入
          const remainingMs = Math.max(0, state.timerState.endTime - Date.now());
          const remainingMinutes = remainingMs / 60000;
          const totalMinutes = state.timerState.totalMinutes;

          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: injectProgressBar,
            args: [totalMinutes, remainingMinutes]
          });
        }
      } catch (error) {
        console.log(`检查标签页 ${tabId} 进度条状态失败:`, error);
      }
    }
  }
});

// 在页面中注入进度条的函数
function injectProgressBar(totalMinutes, remainingMinutes = null) {
  // 如果已存在则移除
  const existing = document.getElementById('pomodoro-progress-bar');
  if (existing) {
    existing.remove();
  }

  // 获取剩余时间（如果是新标签页）
  const actualRemainingMinutes = remainingMinutes !== null ? remainingMinutes : totalMinutes;
  const startProgress = remainingMinutes !== null ? (totalMinutes - remainingMinutes) / totalMinutes : 0;

  // 创建进度条容器
  const container = document.createElement('div');
  container.id = 'pomodoro-progress-bar';
  container.style.cssText = `
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 200px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px 0 0 4px;
    z-index: 2147483647;
    cursor: grab;
    user-select: none;
    box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
    transition: width 0.2s ease;
  `;

  // 创建进度填充
  const fill = document.createElement('div');
  fill.id = 'pomodoro-progress-fill';
  fill.style.cssText = `
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: ${(actualRemainingMinutes / totalMinutes) * 100}%;
    background: linear-gradient(to top, #11998e, #38ef7d);
    border-radius: 4px 0 0 4px;
    transition: height 1s linear;
  `;

  // 创建拖动手柄
  const handle = document.createElement('div');
  handle.style.cssText = `
    position: absolute;
    left: -4px;
    top: 50%;
    width: 16px;
    height: 30px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    cursor: grab;
    transform: translateY(-50%);
  `;

  container.appendChild(fill);
  container.appendChild(handle);
  document.body.appendChild(container);

  // 拖动功能
  let isDragging = false;
  let startY = 0;
  let startTop = 0;

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    startY = e.clientY;
    startTop = parseInt(container.style.top) || 50;
    container.style.cursor = 'grabbing';
    handle.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const deltaY = e.clientY - startY;
    const viewportHeight = window.innerHeight;
    const containerHeight = 200;

    // 计算新的垂直位置（百分比）
    let newTopPercent = ((startY + deltaY) / viewportHeight) * 100;

    // 限制在可视区域内
    const minPercent = (containerHeight / 2 / viewportHeight) * 100;
    const maxPercent = 100 - minPercent;
    newTopPercent = Math.max(minPercent, Math.min(maxPercent, newTopPercent));

    container.style.top = newTopPercent + '%';
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      container.style.cursor = 'grab';
      handle.style.cursor = 'grab';
    }
  });

  // 鼠标悬停效果
  container.addEventListener('mouseenter', () => {
    container.style.width = '12px';
  });

  container.addEventListener('mouseleave', () => {
    if (!isDragging) {
      container.style.width = '8px';
    }
  });

  // 启动进度更新
  const updateInterval = setInterval(() => {
    const progressBar = document.getElementById('pomodoro-progress-bar');
    if (!progressBar) {
      clearInterval(updateInterval);
      return;
    }

    const progressFill = document.getElementById('pomodoro-progress-fill');
    if (!progressFill) {
      clearInterval(updateInterval);
      return;
    }

    // 获取存储的状态
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['timerState'], (result) => {
        if (result.timerState && result.timerState.isRunning && result.timerState.endTime) {
          const remaining = Math.max(0, result.timerState.endTime - Date.now());
          const totalMs = result.timerState.totalMinutes * 60000;
          const progress = (remaining / totalMs) * 100;
          progressFill.style.height = progress + '%';

          // 根据剩余时间改变颜色
          if (progress < 20) {
            progressFill.style.background = 'linear-gradient(to top, #ff416c, #ff4b2b)';
          } else if (progress < 50) {
            progressFill.style.background = 'linear-gradient(to top, #f093fb, #f5576c)';
          }
        } else {
          clearInterval(updateInterval);
          progressBar.remove();
        }
      });
    }
  }, 1000);

  // 保存interval ID以便清理
  container.dataset.intervalId = updateInterval;
}

// 移除进度条的函数
function removeProgressBar() {
  const progressBar = document.getElementById('pomodoro-progress-bar');
  if (progressBar) {
    if (progressBar.dataset.intervalId) {
      clearInterval(parseInt(progressBar.dataset.intervalId));
    }
    progressBar.remove();
  }
}
