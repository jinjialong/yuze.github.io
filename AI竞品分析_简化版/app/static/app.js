// 全局状态
let currentJobId = null;
let pollInterval = null;
let currentCompetitor = null;
let currentSelectedVersion = null;

// 步骤定义
const STEPS = [
    { name: 'screenshot', label: '网页截图' },
    { name: 'text_capture', label: '文本抓取' },
    { name: 'vision', label: '视觉识别' },
    { name: 'clean', label: '数据清洗' },
    { name: 'generate', label: '报告生成' },
    { name: 'review', label: '审查验证' }
];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadCompetitorList();
    showWelcome();
});

// 加载竞品列表
async function loadCompetitorList() {
    try {
        const response = await fetch('/api/competitors');
        const competitors = await response.json();
        renderCompetitorList(competitors);
    } catch (error) {
        console.error('加载竞品列表失败:', error);
    }
}

// 渲染竞品列表
function renderCompetitorList(competitors) {
    const listEl = document.getElementById('competitorList');

    if (competitors.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📁</div>
                <div>暂无竞品分析</div>
            </div>
        `;
        return;
    }

    listEl.innerHTML = competitors.map(c => `
        <div class="competitor-item" data-name="${c.name}">
            <div class="competitor-header" onclick="toggleCompetitor('${c.name}')">
                <span class="icon icon-folder">📁</span>
                <span class="name">${c.name}</span>
                <span class="count">(${c.version_count})</span>
            </div>
            <div class="competitor-versions" id="versions-${c.name}"></div>
        </div>
    `).join('');
}

// 展开/收起竞品
async function toggleCompetitor(name) {
    const item = document.querySelector(`[data-name="${name}"]`);
    const versionsEl = document.getElementById(`versions-${name}`);

    if (item.classList.contains('expanded')) {
        item.classList.remove('expanded');
        return;
    }

    // 加载版本列表
    try {
        const response = await fetch(`/api/competitors/${encodeURIComponent(name)}`);
        const data = await response.json();
        renderVersions(name, data.versions);
        item.classList.add('expanded');
    } catch (error) {
        console.error('加载版本列表失败:', error);
    }
}

// 渲染版本列表
function renderVersions(competitorName, versions) {
    const container = document.getElementById(`versions-${competitorName}`);

    if (!versions || versions.length === 0) {
        container.innerHTML = '<div class="version-item">暂无版本</div>';
        return;
    }

    container.innerHTML = versions.map(v => `
        <div class="version-item ${isSelected(competitorName, v.version) ? 'selected' : ''}"
             data-competitor="${competitorName}"
             data-version="${v.version}"
             onclick="selectVersion('${competitorName}', '${v.version}')">
            <span class="version-label">📄 ${v.version}</span>
            <span class="version-time">${formatDate(v.timestamp)}</span>
            <span class="version-confidence ${v.confidence}">${v.confidence === 'high' ? '高' : '低'}</span>
        </div>
    `).join('');
}

// 判断是否为当前选中项
function isSelected(competitorName, version) {
    return currentSelectedVersion &&
           currentSelectedVersion.competitor === competitorName &&
           currentSelectedVersion.version === version;
}

// 选择版本，在右侧展示报告
async function selectVersion(competitorName, version) {
    // 清除之前的选中态
    document.querySelectorAll('.version-item.selected').forEach(el => el.classList.remove('selected'));

    // 设置新选中态
    currentSelectedVersion = { competitor: competitorName, version };
    const itemEl = document.querySelector(`.version-item[data-competitor="${competitorName}"][data-version="${version}"]`);
    if (itemEl) itemEl.classList.add('selected');

    // 加载并展示报告
    try {
        const reportRes = await fetch(`/api/competitors/${encodeURIComponent(competitorName)}/reports/${version}`);
        const data = await reportRes.json();
        const imageUrl = `/api/competitors/${encodeURIComponent(competitorName)}/reports/${version}/image`;

        showReportInView(competitorName, version, data.content, imageUrl);
    } catch (error) {
        console.error('加载报告失败:', error);
        showError('加载报告失败');
    }
}

// 在右侧报告面板展示内容
function showReportInView(competitorName, version, content, imageUrl) {
    hideAllPanels();
    document.getElementById('reportViewPanel').classList.remove('hidden');

    document.getElementById('reportName').textContent = competitorName;
    document.getElementById('reportVersion').textContent = version;
    document.getElementById('reportTime').textContent = formatDate(version.split('_')[1] || version);

    // 截图
    const screenshotEl = document.getElementById('reportScreenshot');
    screenshotEl.innerHTML = `
        <img src="${imageUrl}" alt="竞品截图"
             onerror="this.parentElement.style.display='none'"
             style="max-width: 100%; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px;">
    `;

    // Markdown 内容
    document.getElementById('reportContent').innerHTML = renderMarkdown(content);
}

// 格式化日期（适配 20260413_023418 格式）
function formatDate(timestamp) {
    if (typeof timestamp === 'string' && timestamp.includes('_')) {
        const [datePart, timePart] = timestamp.split('_');
        const year = datePart.slice(0, 4);
        const month = datePart.slice(4, 6);
        const day = datePart.slice(6, 8);
        const hour = timePart.slice(0, 2);
        const minute = timePart.slice(2, 4);
        return `${year}/${month}/${day} ${hour}:${minute}`;
    }
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
        return timestamp;
    }
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// 显示欢迎面板
function showWelcome() {
    hideAllPanels();
    document.getElementById('welcomePanel').classList.remove('hidden');
}

// 显示新建分析表单
function showNewAnalysis() {
    hideAllPanels();
    document.getElementById('newAnalysisForm').classList.remove('hidden');
    document.getElementById('btnNewAnalysis').disabled = false;

    // 清空表单
    document.getElementById('competitorName').value = '';
    document.getElementById('targetUrl').value = '';

    // 停止轮询
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    currentJobId = null;
}

// 隐藏所有面板
function hideAllPanels() {
    document.getElementById('welcomePanel')?.classList.add('hidden');
    document.getElementById('newAnalysisForm').classList.add('hidden');
    document.getElementById('progressPanel').classList.add('hidden');
    document.getElementById('completePanel').classList.add('hidden');
    document.getElementById('errorPanel').classList.add('hidden');
    document.getElementById('reportViewPanel').classList.add('hidden');
}

// 开始分析
async function startAnalysis() {
    const name = document.getElementById('competitorName').value.trim();
    const url = document.getElementById('targetUrl').value.trim();

    if (!name) {
        showError('请输入竞品名称');
        return;
    }
    if (!url) {
        showError('请输入目标URL');
        return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showError('URL 格式不正确，请以 http:// 或 https:// 开头');
        return;
    }

    // 禁用新建按钮
    document.getElementById('btnNewAnalysis').disabled = true;

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ competitor_name: name, url: url })
        });

        const data = await response.json();

        if (data.job_id) {
            currentJobId = data.job_id;
            currentCompetitor = name;
            showProgressPanel();
            startPolling();
        } else {
            showError('启动分析失败');
            document.getElementById('btnNewAnalysis').disabled = false;
        }
    } catch (error) {
        showError('请求失败: ' + error.message);
        document.getElementById('btnNewAnalysis').disabled = false;
    }
}

// 显示进度面板
function showProgressPanel() {
    hideAllPanels();
    document.getElementById('progressPanel').classList.remove('hidden');

    // 初始化步骤显示
    const stepsEl = document.getElementById('stepsList');
    stepsEl.innerHTML = STEPS.map((step, i) => `
        <div class="step pending" id="step-${step.name}">
            <span class="step-icon">○</span>
            <span class="step-text">${step.label}</span>
        </div>
        ${i < STEPS.length - 1 ? '<div class="step-connector"></div>' : ''}
    `).join('');

    updateProgress(0, '');
}

// 更新进度
function updateProgress(progress, stepName) {
    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = `${progress}%`;
}

// 开始轮询
function startPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
    }

    pollInterval = setInterval(async () => {
        if (!currentJobId) return;

        try {
            const response = await fetch(`/api/progress/${currentJobId}`);
            const data = await response.json();

            updateStepStatus(data.steps);
            updateProgress(data.progress, data.step_name);

            if (data.status === 'success') {
                clearInterval(pollInterval);
                pollInterval = null;
                showCompletePanel(data.result);
                loadCompetitorList(); // 刷新列表
            } else if (data.status === 'failed') {
                clearInterval(pollInterval);
                pollInterval = null;
                showErrorPanel(data.error);
            }
        } catch (error) {
            console.error('轮询失败:', error);
        }
    }, 1000);
}

// 更新步骤状态
function updateStepStatus(steps) {
    if (!steps) return;

    steps.forEach(step => {
        const stepEl = document.getElementById(`step-${step.name}`);
        if (!stepEl) return;
        stepEl.className = `step ${step.status}`;

        const iconEl = stepEl.querySelector('.step-icon');
        if (step.status === 'completed') {
            iconEl.textContent = '✓';
        } else if (step.status === 'processing') {
            iconEl.innerHTML = '<span class="pulse-dot"></span>';
        } else {
            iconEl.textContent = '○';
        }
    });
}

// 显示完成面板
function showCompletePanel(result) {
    hideAllPanels();
    document.getElementById('completePanel').classList.remove('hidden');
    document.getElementById('btnNewAnalysis').disabled = false;

    const confidenceBadge = document.getElementById('confidenceBadge');
    confidenceBadge.textContent = `置信度: ${result.confidence === 'high' ? '高 ✓' : '低 ⚠️'}`;
    confidenceBadge.className = `confidence ${result.confidence}`;

    const durationText = document.getElementById('durationText');
    durationText.textContent = '分析完成';
}

// 查看完成的报告（直接展示在右侧）
async function viewCompletedReport() {
    if (!currentCompetitor) return;

    try {
        const response = await fetch(`/api/competitors/${encodeURIComponent(currentCompetitor)}`);
        const data = await response.json();

        if (data.versions && data.versions.length > 0) {
            // 取最新版本
            const latest = data.versions[0];
            selectVersion(currentCompetitor, latest.version);
        }
    } catch (error) {
        console.error('加载报告失败:', error);
        showError('加载报告失败');
    }
}

// 显示错误面板
function showErrorPanel(error) {
    hideAllPanels();
    document.getElementById('errorPanel').classList.remove('hidden');
    document.getElementById('btnNewAnalysis').disabled = false;

    document.getElementById('errorMessage').textContent = error || '分析过程中出现错误，临时文件已自动清理，请重新提交分析';
}

// 显示报告列表弹窗
async function showReportList() {
    if (!currentCompetitor) return;

    try {
        const response = await fetch(`/api/competitors/${encodeURIComponent(currentCompetitor)}`);
        const data = await response.json();

        document.getElementById('reportListTitle').textContent = `${data.competitor_name} - 历史版本`;

        const listEl = document.getElementById('versionList');
        if (!data.versions || data.versions.length === 0) {
            listEl.innerHTML = '<div class="empty-state">暂无历史版本</div>';
        } else {
            listEl.innerHTML = data.versions.map(v => `
                <div class="version-card">
                    <div class="version-header">
                        <span class="version-name">${v.version}</span>
                        <span class="version-confidence ${v.confidence}">${v.confidence === 'high' ? '高' : '低'}</span>
                    </div>
                    <div class="version-time">${formatDate(v.timestamp)}</div>
                    <div class="version-actions">
                        <button class="btn-primary" onclick="closeModal('reportListModal'); selectVersion('${data.competitor_name}', '${v.version}')">查看</button>
                    </div>
                </div>
            `).join('');
        }

        openModal('reportListModal');
    } catch (error) {
        showError('加载报告列表失败');
    }
}

// 简单 Markdown 渲染
function renderMarkdown(content) {
    if (!content) return '';

    let html = content;

    html = html.replace(/(^>.*$\n?)+/gm, (match) => {
        const inner = match.replace(/^> ?/gm, '').trim();
        return `<blockquote class="confidence-warning">${inner}</blockquote>`;
    });

    return html
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^---$/gim, '<hr>')
        .replace(/^\s*[-*+]\s+(.*$)/gim, '<li>$1</li>')
        .replace(/([^>])(\n\n)([^<])/g, '$1</p><p>$3')
        .replace(/\n/g, '<br>');
}

// 弹窗控制
function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// 显示错误提示
function showError(message) {
    document.getElementById('errorModalText').textContent = message;
    openModal('errorModal');
}

// 点击弹窗外部关闭
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
});
