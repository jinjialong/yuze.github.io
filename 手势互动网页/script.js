// 签文数据
const fortunes = [
    // 上上签 (2签)
    {
        name: '龙腾四海',
        level: '上上签',
        phrase: '飞龙在天',
        meaning: '时来运转，万事如意，事业飞黄腾达，财运亨通。',
        type: 'top'
    },
    {
        name: '紫气东来',
        level: '上上签',
        phrase: '福星高照',
        meaning: '贵人相助，诸事顺遂，好运连连，心想事成。',
        type: 'top'
    },
    // 上签 (4签)
    {
        name: '春风得意',
        level: '上签',
        phrase: '前程似锦',
        meaning: '事业顺利，步步高升，时机正好，把握机遇。',
        type: 'good'
    },
    {
        name: '马到成功',
        level: '上签',
        phrase: '一举成名',
        meaning: '行动果断，目标明确，努力必有回报。',
        type: 'good'
    },
    {
        name: '吉星高照',
        level: '上签',
        phrase: '鸿运当头',
        meaning: '运势正旺，做什么事情都顺风顺水。',
        type: 'good'
    },
    {
        name: '福禄双至',
        level: '上签',
        phrase: '财源广进',
        meaning: '福气与财运同来，生活美满富足。',
        type: 'good'
    },
    // 中上签 (4签)
    {
        name: '稳中求进',
        level: '中上签',
        phrase: '步步为营',
        meaning: '稳扎稳打，循序渐进，成功指日可待。',
        type: 'medium-good'
    },
    {
        name: '守得云开',
        level: '中上签',
        phrase: '见月明',
        meaning: '坚持就是胜利，困难即将过去，光明在前方。',
        type: 'medium-good'
    },
    {
        name: '贵人指路',
        level: '中上签',
        phrase: '指点迷津',
        meaning: '有贵人相助，迷茫时会有明人指点方向。',
        type: 'medium-good'
    },
    {
        name: '雨过天晴',
        level: '中上签',
        phrase: '彩虹现',
        meaning: '困难已经过去，美好的日子即将来临。',
        type: 'medium-good'
    },
    // 中签 (2签)
    {
        name: '平安是福',
        level: '中签',
        phrase: '知足常乐',
        meaning: '平淡是真，平安健康就是最大的福气。',
        type: 'medium'
    },
    {
        name: '细水长流',
        level: '中签',
        phrase: '积少成多',
        meaning: '持之以恒，日积月累，终有收获之时。',
        type: 'medium'
    }
];

// DOM 元素
const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusText = document.getElementById('status-text');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const countdownText = document.getElementById('countdown-text');
const bucket = document.getElementById('bucket');
const cardContainer = document.getElementById('card-container');
const fortuneCard = document.getElementById('fortune-card');
const retryBtn = document.getElementById('retry-btn');
const particlesContainer = document.getElementById('particles');

// 状态变量
let handDetected = false;
let handDetectionStartTime = null;
const DETECTION_THRESHOLD = 2000; // 2秒触发
let isDrawing = false;
let currentFortune = null;

// 初始化
async function init() {
    setupHands();
    setupCamera();
    setupEventListeners();
}

// 设置 MediaPipe Hands
function setupHands() {
    const hands = new Hands({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onHandsResults);

    // 保存引用以便后续使用
    window.hands = hands;
}

// 设置摄像头
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 320,
                height: 240,
                facingMode: 'user'
            }
        });

        videoElement.srcObject = stream;

        videoElement.addEventListener('loadeddata', () => {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            startDetection();
        });
    } catch (error) {
        console.error('摄像头访问失败:', error);
        statusText.textContent = '请允许摄像头访问';
    }
}

// 开始检测
function startDetection() {
    if (window.hands) {
        const detectFrame = async () => {
            if (videoElement.readyState >= 2) {
                await window.hands.send({image: videoElement});
            }
            requestAnimationFrame(detectFrame);
        };
        detectFrame();
    }
}

// 处理手势检测结果
function onHandsResults(results) {
    // 清除画布
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // 绘制摄像头画面
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        // 检测到手
        const landmarks = results.multiHandLandmarks[0];

        // 绘制手部关键点
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
            color: '#00FF00',
            lineWidth: 2
        });
        drawLandmarks(canvasCtx, landmarks, {
            color: '#FF0000',
            lineWidth: 1,
            radius: 3
        });

        // 检测手掌
        if (detectPalm(landmarks)) {
            if (!handDetected) {
                handDetected = true;
                handDetectionStartTime = Date.now();
                onHandDetected();
            } else {
                updateProgress();
            }
        } else {
            resetDetection();
        }
    } else {
        resetDetection();
    }

    canvasCtx.restore();
}

// 检测手掌（判断是否有张开的手掌）
function detectPalm(landmarks) {
    // 计算手掌大小（手腕到中指根部的距离）
    const wrist = landmarks[0];
    const middleFingerMCP = landmarks[9];
    const palmSize = Math.sqrt(
        Math.pow(middleFingerMCP.x - wrist.x, 2) +
        Math.pow(middleFingerMCP.y - wrist.y, 2)
    );

    // 检测手指是否伸展
    const fingers = [8, 12, 16, 20]; // 指尖索引
    const fingerBases = [5, 9, 13, 17]; // 手指根部索引

    let extendedFingers = 0;

    for (let i = 0; i < fingers.length; i++) {
        const tip = landmarks[fingers[i]];
        const base = landmarks[fingerBases[i]];
        const wrist = landmarks[0];

        // 计算指尖到手腕的距离
        const tipToWrist = Math.sqrt(
            Math.pow(tip.x - wrist.x, 2) +
            Math.pow(tip.y - wrist.y, 2)
        );

        // 如果指尖到手腕的距离大于手指根部到手腕距离的1.5倍，认为手指伸展
        const baseToWrist = Math.sqrt(
            Math.pow(base.x - wrist.x, 2) +
            Math.pow(base.y - wrist.y, 2)
        );

        if (tipToWrist > baseToWrist * 1.2) {
            extendedFingers++;
        }
    }

    // 至少3根手指伸展认为是手掌
    return extendedFingers >= 3 && palmSize > 0.1;
}

// 检测到手时的处理
function onHandDetected() {
    statusText.textContent = '保持手势 3...';
    statusText.classList.add('detected');
    progressContainer.classList.remove('hidden');

    // 开始摇晃签筒
    bucket.classList.add('shaking');
}

// 更新进度
function updateProgress() {
    const elapsed = Date.now() - handDetectionStartTime;
    const progress = Math.min(elapsed / DETECTION_THRESHOLD, 1);

    // 更新进度条
    progressFill.style.width = `${progress * 100}%`;

    // 更新倒计时
    const remaining = Math.ceil((DETECTION_THRESHOLD - elapsed) / 1000);
    countdownText.textContent = Math.max(remaining, 1);

    // 检查是否达到阈值
    if (elapsed >= DETECTION_THRESHOLD && !isDrawing) {
        isDrawing = true;
        drawFortune();
    }
}

// 重置检测
function resetDetection() {
    handDetected = false;
    handDetectionStartTime = null;
    statusText.textContent = '请伸出手掌';
    statusText.classList.remove('detected');
    progressContainer.classList.add('hidden');
    progressFill.style.width = '0%';
    bucket.classList.remove('shaking');
}

// 抽签
function drawFortune() {
    // 随机选择一个签
    const randomIndex = Math.floor(Math.random() * fortunes.length);
    currentFortune = fortunes[randomIndex];

    // 更新签卡内容
    document.getElementById('fortune-name').textContent = currentFortune.name;
    document.getElementById('fortune-level').textContent = currentFortune.level;
    document.getElementById('fortune-phrase').textContent = currentFortune.phrase;
    document.getElementById('fortune-meaning').textContent = currentFortune.meaning;

    // 根据签的等级设置颜色
    const levelElement = document.getElementById('fortune-level');
    const nameElement = document.getElementById('fortune-name');

    switch(currentFortune.type) {
        case 'top':
            levelElement.style.color = '#c41e3a';
            levelElement.style.borderColor = '#c41e3a';
            nameElement.style.color = '#c41e3a';
            break;
        case 'good':
            levelElement.style.color = '#b8860b';
            levelElement.style.borderColor = '#b8860b';
            nameElement.style.color = '#b8860b';
            break;
        case 'medium-good':
            levelElement.style.color = '#228b22';
            levelElement.style.borderColor = '#228b22';
            nameElement.style.color = '#228b22';
            break;
        case 'medium':
            levelElement.style.color = '#4682b4';
            levelElement.style.borderColor = '#4682b4';
            nameElement.style.color = '#4682b4';
            break;
    }

    // 停止摇晃
    bucket.classList.remove('shaking');

    // 显示签卡
    setTimeout(() => {
        cardContainer.classList.remove('hidden');
        cardContainer.classList.add('show');

        // 创建金色粒子效果
        createGoldParticles();

        // 显示再抽一签按钮
        setTimeout(() => {
            retryBtn.classList.remove('hidden');
        }, 1500);
    }, 500);

    // 更新状态
    statusText.textContent = '恭喜抽中！';
    progressContainer.classList.add('hidden');
}

// 创建金色粒子效果
function createGoldParticles() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const particle = document.createElement('div');
            particle.className = 'gold-particle';

            // 随机位置
            const startX = centerX + (Math.random() - 0.5) * 100;
            const startY = centerY + (Math.random() - 0.5) * 100;

            // 随机方向
            const angle = Math.random() * Math.PI * 2;
            const distance = 100 + Math.random() * 200;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;

            particle.style.left = startX + 'px';
            particle.style.top = startY + 'px';
            particle.style.setProperty('--tx', tx + 'px');
            particle.style.setProperty('--ty', ty + 'px');

            // 随机大小
            const size = 4 + Math.random() * 8;
            particle.style.width = size + 'px';
            particle.style.height = size + 'px';

            particlesContainer.appendChild(particle);

            // 动画结束后移除
            setTimeout(() => {
                particle.remove();
            }, 2000);
        }, i * 30);
    }
}

// 重置抽签
function resetDraw() {
    isDrawing = false;
    currentFortune = null;

    // 隐藏签卡和按钮
    cardContainer.classList.add('hidden');
    cardContainer.classList.remove('show');
    retryBtn.classList.add('hidden');

    // 重置签卡动画
    fortuneCard.style.animation = 'none';
    setTimeout(() => {
        fortuneCard.style.animation = '';
    }, 10);

    // 重置状态
    resetDetection();
}

// 设置事件监听
function setupEventListeners() {
    retryBtn.addEventListener('click', resetDraw);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
