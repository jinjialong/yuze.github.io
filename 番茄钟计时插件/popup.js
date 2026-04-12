// 番茄钟计时器 - 弹出窗口脚本

const timeInput = document.getElementById('timeInput');
const actionBtn = document.getElementById('actionBtn');
const statusDiv = document.getElementById('status');
const remainingSection = document.getElementById('remainingSection');
const remainingValue = document.getElementById('remainingValue');
const quickBtns = document.querySelectorAll('.quick-btn');

let isRunning = false;

// 初始化 - 获取当前计时状态
async function init() {
  const state = await chrome.storage.local.get(['timerState']);

  if (state.timerState) {
    const { isRunning: running, totalMinutes, endTime } = state.timerState;
    isRunning = running;

    if (isRunning && endTime) {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);

      if (remaining > 0) {
        // 计时器正在运行
        updateUIForRunning(remaining);
        startUIUpdate();
      } else {
        // 计时器已结束但未清理
        await stopTimer();
      }
    } else {
      updateUIForStopped();
      if (totalMinutes) {
        timeInput.value = totalMinutes;
      }
    }
  }
}

// 更新UI为运行状态
function updateUIForRunning(remainingMs) {
  isRunning = true;
  actionBtn.textContent = '结束计时';
  actionBtn.classList.remove('btn-start');
  actionBtn.classList.add('btn-stop');
  timeInput.disabled = true;
  quickBtns.forEach(btn => btn.disabled = true);
  remainingSection.classList.remove('hidden');
  statusDiv.textContent = '计时中...';
  statusDiv.classList.add('running');
  updateRemainingDisplay(remainingMs);
}

// 更新UI为停止状态
function updateUIForStopped() {
  isRunning = false;
  actionBtn.textContent = '开始计时';
  actionBtn.classList.remove('btn-stop');
  actionBtn.classList.add('btn-start');
  timeInput.disabled = false;
  quickBtns.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('active');
  });
  remainingSection.classList.add('hidden');
  statusDiv.textContent = '';
  statusDiv.classList.remove('running');
}

// 更新剩余时间显示
function updateRemainingDisplay(remainingMs) {
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  remainingValue.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// 启动UI更新定时器
function startUIUpdate() {
  const updateInterval = setInterval(async () => {
    if (!isRunning) {
      clearInterval(updateInterval);
      return;
    }

    const state = await chrome.storage.local.get(['timerState']);
    if (state.timerState && state.timerState.isRunning && state.timerState.endTime) {
      const remaining = Math.max(0, state.timerState.endTime - Date.now());
      updateRemainingDisplay(remaining);

      if (remaining === 0) {
        clearInterval(updateInterval);
        updateUIForStopped();
      }
    } else {
      clearInterval(updateInterval);
      updateUIForStopped();
    }
  }, 1000);
}

// 快捷按钮点击
quickBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (isRunning) return;

    const minutes = btn.dataset.minutes;
    timeInput.value = minutes;

    // 更新按钮激活状态
    quickBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// 手动输入时清除按钮激活状态
timeInput.addEventListener('input', () => {
  quickBtns.forEach(btn => btn.classList.remove('active'));
});

// 主按钮点击 - 开始/结束计时
actionBtn.addEventListener('click', async () => {
  if (isRunning) {
    await stopTimer();
  } else {
    await startTimer();
  }
});

// 开始计时
async function startTimer() {
  let minutes = parseInt(timeInput.value) || 25;

  // 限制范围
  if (minutes < 1) minutes = 1;
  if (minutes > 180) minutes = 180;

  timeInput.value = minutes;

  const endTime = Date.now() + minutes * 60000;

  // 保存计时状态
  await chrome.storage.local.set({
    timerState: {
      isRunning: true,
      totalMinutes: minutes,
      endTime: endTime,
      startTime: Date.now()
    }
  });

  // 创建闹钟提醒
  await chrome.alarms.create('pomodoroTimer', {
    when: endTime
  });

  // 通知后台脚本启动进度条
  await chrome.runtime.sendMessage({ action: 'startTimer', totalMinutes: minutes });

  updateUIForRunning(minutes * 60000);
  startUIUpdate();
}

// 停止计时
async function stopTimer() {
  // 清除状态
  await chrome.storage.local.remove(['timerState']);

  // 清除闹钟
  await chrome.alarms.clear('pomodoroTimer');

  // 通知后台脚本停止进度条
  await chrome.runtime.sendMessage({ action: 'stopTimer' });

  updateUIForStopped();
}

// 页面加载时初始化
init();
