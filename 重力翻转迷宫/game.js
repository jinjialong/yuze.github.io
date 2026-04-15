(function () {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const startPanel = document.getElementById("startPanel");
  const finishPanel = document.getElementById("finishPanel");
  const levelLabel = document.getElementById("levelLabel");
  const moveLabel = document.getElementById("moveLabel");
  const statusLabel = document.getElementById("statusLabel");
  const gravityLabel = document.getElementById("gravityLabel");
  const finishKicker = document.getElementById("finishKicker");
  const finishTitle = document.getElementById("finishTitle");
  const finishText = document.getElementById("finishText");
  const nextButton = document.getElementById("nextButton");

  const tileSize = 40;
  const bounce = 0.18;
  const gravityStrength = 1400;
  const drag = 0.996;
  const maxSpeed = 620;
  const restartDelay = 650;
  const dirLabels = {
    up: "向上",
    down: "向下",
    left: "向左",
    right: "向右"
  };

  const rawLevels = [
    {
      name: "试手",
      hint: "第一关只看规则。先向上，再向右，感受一下重力翻转。",
      map: [
        "################",
        "#............G.#",
        "#..............#",
        "#....####......#",
        "#....####......#",
        "#..............#",
        "#..............#",
        "#S.............#",
        "################"
      ]
    },
    {
      name: "绕刺",
      hint: "尖刺开始出现了。不要硬冲，先贴墙换到安全线路。",
      map: [
        "################",
        "#......^.....G.#",
        "#......^.......#",
        "#......^.......#",
        "#..............#",
        "#..######......#",
        "#..............#",
        "#S.............#",
        "################"
      ]
    },
    {
      name: "折返热身",
      hint: "这关开始要学会借拐角停住，路线比前两关更像滑轨拼图。",
      map: [
        "################",
        "################",
        "################",
        "###.........G###",
        "###.############",
        "###........#####",
        "##########.#####",
        "#S.........#####",
        "################"
      ]
    },
    {
      name: "第一章收束",
      hint: "这是基础区最后一关。别急着求快，先把每个停靠点看清楚。",
      map: [
        "################",
        "#...........#G.#",
        "#..####.....#..#",
        "#......^....#..#",
        "#..#........##.#",
        "#..#..#####....#",
        "#..#...........#",
        "#S.#...........#",
        "################"
      ]
    },
    {
      name: "镜像折返",
      hint: "第二章开始，路线会反着考你。习惯从右侧起手，再找回节奏。",
      map: [
        "################",
        "################",
        "################",
        "###G.........###",
        "############.###",
        "#####........###",
        "#####.##########",
        "#####.........S#",
        "################"
      ]
    },
    {
      name: "长走廊",
      hint: "这里开始进入长回廊。连续两三步都要提前想好，不然就得整段重来。",
      map: [
        "################",
        "#......#....G###",
        "#.####.#.##.####",
        "#.#....#.#.....#",
        "#.#.####.#.###.#",
        "#.#......#...#.#",
        "#.##########.#.#",
        "#S...........#.#",
        "################"
      ]
    },
    {
      name: "反向长走廊",
      hint: "同样是长回廊，但视角反了。错一次方向，就会多走整段路径。",
      map: [
        "################",
        "###G....#......#",
        "####.##.#.####.#",
        "#.....#.#....#.#",
        "#.###.#.####.#.#",
        "#.#...#......#.#",
        "#.#.##########.#",
        "#.#...........S#",
        "################"
      ]
    },
    {
      name: "倒置长走廊",
      hint: "第二章最后一关把路线整体翻过来了。别只记顺序，要记停靠关系。",
      map: [
        "################",
        "#S...........#.#",
        "#.##########.#.#",
        "#.#......#...#.#",
        "#.#.####.#.###.#",
        "#.#....#.#.....#",
        "#.####.#.##.####",
        "#......#....G###",
        "################"
      ]
    },
    {
      name: "镜像高压",
      hint: "高压区开始了。路线和前面相似，但容错更低，错路更容易把你送回原点。",
      map: [
        "################",
        "#.#...........S#",
        "#.#.##########.#",
        "#.#...#......#.#",
        "#.###.#.####.#.#",
        "#.....#.#....#.#",
        "####.##.#.####.#",
        "###G....#......#",
        "################"
      ]
    },
    {
      name: "针刺走廊",
      hint: "开始把危险放进走廊里了。最佳路线没变，但你不能再乱试。",
      map: [
        "################",
        "#......#....G###",
        "#.####.#.##^####",
        "#.#....#.#.....#",
        "#.#.####.#.###.#",
        "#.#......#...#.#",
        "#.##########.#.#",
        "#S...........#.#",
        "################"
      ]
    },
    {
      name: "反向针刺",
      hint: "这一关会故意诱导你按老习惯操作，但错误方向现在会直接吃刺。",
      map: [
        "################",
        "###G....#......#",
        "####^##.#.####.#",
        "#.....#.#....#.#",
        "#.###.#.####.#.#",
        "#.#...#......#.#",
        "#.#.##########.#",
        "#.#...........S#",
        "################"
      ]
    },
    {
      name: "终局试炼",
      hint: "最终关把错路做成了陷阱。先把整条线路在脑子里走一遍，再动手翻转。",
      map: [
        "################",
        "#......#....G###",
        "#.####.#.##^####",
        "#.#....#.#^....#",
        "#.#.####.#.###.#",
        "#.#......#...#.#",
        "#.##########^#.#",
        "#S...........#.#",
        "################"
      ]
    }
  ];

  const levels = rawLevels.map(parseLevel);
  const state = {
    currentLevelIndex: 0,
    ball: null,
    gravity: { x: 0, y: 1, dir: "down" },
    moves: 0,
    started: false,
    finishVisible: false,
    status: "等待开始",
    statusUntil: 0,
    pendingResetAt: 0,
    flashAlpha: 0,
    particles: [],
    lastTimestamp: 0
  };

  function getChapterInfo(levelIndex) {
    if (levelIndex < 4) {
      return { name: "基础区", range: "1-4" };
    }

    if (levelIndex < 8) {
      return { name: "进阶区", range: "5-8" };
    }

    return { name: "高压区", range: "9-12" };
  }

  function parseLevel(level) {
    const rows = level.map;
    const height = rows.length;
    const width = rows[0].length;
    let spawn = null;
    let goal = null;

    rows.forEach((row, y) => {
      if (row.length !== width) {
        throw new Error(`关卡 ${level.name} 行宽不一致。`);
      }

      row.split("").forEach((cell, x) => {
        if (cell === "S") {
          spawn = { x, y };
        }

        if (cell === "G") {
          goal = { x, y };
        }
      });
    });

    if (!spawn || !goal) {
      throw new Error(`关卡 ${level.name} 缺少起点或终点。`);
    }

    return {
      ...level,
      rows,
      width,
      height,
      spawn,
      goal,
      worldWidth: width * tileSize,
      worldHeight: height * tileSize
    };
  }

  function createBall(level) {
    const centerX = (level.spawn.x + 0.5) * tileSize;
    const centerY = (level.spawn.y + 0.5) * tileSize;

    return {
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
      radius: tileSize * 0.26,
      squash: 0
    };
  }

  function resetLevel(preserveStatus) {
    const level = levels[state.currentLevelIndex];
    state.ball = createBall(level);
    state.gravity = { x: 0, y: 1, dir: "down" };
    state.moves = 0;
    state.pendingResetAt = 0;
    state.flashAlpha = 0;
    state.particles = [];
    state.finishVisible = false;

    if (!preserveStatus) {
      setStatus(level.hint);
    }

    hideFinish();
    syncHud();
  }

  function syncHud() {
    const totalLevels = levels.length;
    levelLabel.textContent = `${state.currentLevelIndex + 1} / ${totalLevels}`;
    moveLabel.textContent = String(state.moves);
    gravityLabel.textContent = dirLabels[state.gravity.dir];
  }

  function setStatus(text, durationMs) {
    state.status = text;
    statusLabel.textContent = text;
    state.statusUntil = durationMs ? performance.now() + durationMs : 0;
  }

  function setGravity(direction) {
    if (!state.started || state.finishVisible) {
      return;
    }

    if (state.gravity.dir === direction) {
      return;
    }

    const vector = {
      up: { x: 0, y: -1, dir: "up" },
      down: { x: 0, y: 1, dir: "down" },
      left: { x: -1, y: 0, dir: "left" },
      right: { x: 1, y: 0, dir: "right" }
    }[direction];

    state.gravity = vector;
    state.moves += 1;
    state.flashAlpha = 0.28;
    state.ball.squash = 0.18;
    setStatus(`重力切换到${dirLabels[direction]}`, 900);
    syncHud();
  }

  function scheduleReset() {
    if (state.pendingResetAt) {
      return false;
    }

    state.pendingResetAt = performance.now() + restartDelay;
    state.ball.vx = 0;
    state.ball.vy = 0;
    setStatus("撞上陷阱了，正在重开…", restartDelay);
    return true;
  }

  function finishLevel() {
    state.finishVisible = true;
    spawnParticles(24, state.ball.x, state.ball.y, "#7df2d3");
    const currentLevel = levels[state.currentLevelIndex];
    const nextLevel = levels[(state.currentLevelIndex + 1) % levels.length];

    if (state.currentLevelIndex === levels.length - 1) {
      finishKicker.textContent = "全部通关";
      finishTitle.textContent = "你把所有迷宫都翻过来了";
      finishText.textContent = `12 关已经全部完成。最后四关的高压线路也过掉了，可以再来一轮挑战更少翻转次数。`;
      nextButton.textContent = "重新开始";
    } else if (state.currentLevelIndex === 3) {
      finishKicker.textContent = "基础区完成";
      finishTitle.textContent = "进入进阶区";
      finishText.textContent = `前 4 关已经过完。接下来的第 5 到第 8 关会拉长回廊，开始逼你连续规划两三步。`;
      nextButton.textContent = "进入下一章";
    } else if (state.currentLevelIndex === 7) {
      finishKicker.textContent = "进阶区完成";
      finishTitle.textContent = "进入高压区";
      finishText.textContent = `中段 4 关已经结束。第 9 到第 12 关会把错路做成陷阱，试错成本会明显更高。`;
      nextButton.textContent = "进入最终章";
    } else {
      finishKicker.textContent = `${getChapterInfo(state.currentLevelIndex).name} · 第 ${state.currentLevelIndex + 1} 关完成`;
      finishTitle.textContent = "继续下一关";
      finishText.textContent = `本关“${currentLevel.name}”用了 ${state.moves} 次翻转。下一关是“${nextLevel.name}”，会继续提高路线判断压力。`;
      nextButton.textContent = "下一关";
    }

    finishPanel.classList.add("visible");
    setStatus("抵达终点。");
  }

  function hideFinish() {
    state.finishVisible = false;
    finishPanel.classList.remove("visible");
  }

  function startGame() {
    state.started = true;
    startPanel.classList.remove("visible");
    resetLevel(false);
  }

  function goToMenu() {
    state.started = false;
    hideFinish();
    startPanel.classList.add("visible");
    setStatus("先试试方向键，或者点击下面的重力按钮。");
  }

  function nextLevel() {
    if (state.currentLevelIndex === levels.length - 1) {
      state.currentLevelIndex = 0;
    } else {
      state.currentLevelIndex += 1;
    }

    resetLevel(false);
  }

  function update(deltaMs, now) {
    if (state.statusUntil && now > state.statusUntil && state.started && !state.finishVisible) {
      setStatus(levels[state.currentLevelIndex].hint);
    }

    updateParticles(deltaMs);

    if (!state.started || state.finishVisible) {
      return;
    }

    if (state.pendingResetAt) {
      if (now >= state.pendingResetAt) {
        resetLevel(true);
        setStatus(levels[state.currentLevelIndex].hint);
      }

      return;
    }

    const level = levels[state.currentLevelIndex];
    const ball = state.ball;
    const dt = Math.min(deltaMs / 1000, 0.024);

    ball.vx += state.gravity.x * gravityStrength * dt;
    ball.vy += state.gravity.y * gravityStrength * dt;
    ball.vx *= Math.pow(drag, deltaMs / 16.67);
    ball.vy *= Math.pow(drag, deltaMs / 16.67);
    ball.vx = clamp(ball.vx, -maxSpeed, maxSpeed);
    ball.vy = clamp(ball.vy, -maxSpeed, maxSpeed);

    ball.x += ball.vx * dt;
    resolveCollisions(level, ball, "x");
    ball.y += ball.vy * dt;
    resolveCollisions(level, ball, "y");

    ball.squash = Math.max(0, ball.squash - dt * 1.6);
    state.flashAlpha = Math.max(0, state.flashAlpha - dt * 0.5);

    if (touchesHazard(level, ball)) {
      if (scheduleReset()) {
        spawnParticles(16, ball.x, ball.y, "#ff6f61");
      }
    } else if (touchesGoal(level, ball)) {
      finishLevel();
    }
  }

  function resolveCollisions(level, ball, axis) {
    const minX = Math.max(0, Math.floor((ball.x - ball.radius) / tileSize) - 1);
    const maxX = Math.min(level.width - 1, Math.floor((ball.x + ball.radius) / tileSize) + 1);
    const minY = Math.max(0, Math.floor((ball.y - ball.radius) / tileSize) - 1);
    const maxY = Math.min(level.height - 1, Math.floor((ball.y + ball.radius) / tileSize) + 1);

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (!isSolid(level, x, y)) {
          continue;
        }

        const left = x * tileSize;
        const top = y * tileSize;
        const right = left + tileSize;
        const bottom = top + tileSize;

        if (
          ball.x + ball.radius <= left ||
          ball.x - ball.radius >= right ||
          ball.y + ball.radius <= top ||
          ball.y - ball.radius >= bottom
        ) {
          continue;
        }

        if (axis === "x") {
          if (ball.vx > 0) {
            ball.x = left - ball.radius;
          } else if (ball.vx < 0) {
            ball.x = right + ball.radius;
          }

          ball.vx *= -bounce;
        } else {
          if (ball.vy > 0) {
            ball.y = top - ball.radius;
          } else if (ball.vy < 0) {
            ball.y = bottom + ball.radius;
          }

          ball.vy *= -bounce;
        }

        ball.squash = 0.12;
      }
    }
  }

  function touchesHazard(level, ball) {
    return tileOverlap(level, ball, "^");
  }

  function touchesGoal(level, ball) {
    return tileOverlap(level, ball, "G");
  }

  function tileOverlap(level, ball, tile) {
    const minX = Math.max(0, Math.floor((ball.x - ball.radius) / tileSize));
    const maxX = Math.min(level.width - 1, Math.floor((ball.x + ball.radius) / tileSize));
    const minY = Math.max(0, Math.floor((ball.y - ball.radius) / tileSize));
    const maxY = Math.min(level.height - 1, Math.floor((ball.y + ball.radius) / tileSize));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (level.rows[y][x] !== tile) {
          continue;
        }

        const left = x * tileSize;
        const top = y * tileSize;
        const right = left + tileSize;
        const bottom = top + tileSize;

        if (
          ball.x + ball.radius > left &&
          ball.x - ball.radius < right &&
          ball.y + ball.radius > top &&
          ball.y - ball.radius < bottom
        ) {
          return true;
        }
      }
    }

    return false;
  }

  function isSolid(level, x, y) {
    return level.rows[y][x] === "#";
  }

  function spawnParticles(count, x, y, color) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 180;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.5,
        color
      });
    }
  }

  function updateParticles(deltaMs) {
    const dt = deltaMs / 1000;
    state.particles = state.particles.filter((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      return particle.life > 0;
    });
  }

  function render() {
    const level = levels[state.currentLevelIndex];
    canvas.width = level.worldWidth;
    canvas.height = level.worldHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground(level);
    drawGrid(level);
    drawLevel(level);
    drawGoalPulse(level);
    drawParticles();
    drawBall();
    drawGravityArrow(level);
    drawFlash(level);
  }

  function drawBackground(level) {
    const gradient = ctx.createLinearGradient(0, 0, level.worldWidth, level.worldHeight);
    gradient.addColorStop(0, "#091723");
    gradient.addColorStop(1, "#102635");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, level.worldWidth, level.worldHeight);
  }

  function drawGrid(level) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;

    for (let x = 0; x <= level.width; x += 1) {
      const px = x * tileSize;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, level.worldHeight);
      ctx.stroke();
    }

    for (let y = 0; y <= level.height; y += 1) {
      const py = y * tileSize;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(level.worldWidth, py);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawLevel(level) {
    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const tile = level.rows[y][x];
        const px = x * tileSize;
        const py = y * tileSize;

        if (tile === "#") {
          drawWall(px, py);
        } else if (tile === "^") {
          drawSpike(px, py);
        } else if (tile === "S") {
          drawSpawn(px, py);
        } else if (tile === "G") {
          drawGoalTile(px, py);
        }
      }
    }
  }

  function drawWall(x, y) {
    const radius = 10;
    ctx.save();
    ctx.fillStyle = "#173a52";
    ctx.strokeStyle = "rgba(143, 210, 255, 0.24)";
    ctx.lineWidth = 2;
    roundRect(ctx, x + 2, y + 2, tileSize - 4, tileSize - 4, radius);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRect(ctx, x + 6, y + 6, tileSize - 12, tileSize * 0.32, 6);
    ctx.fill();
    ctx.restore();
  }

  function drawSpike(x, y) {
    ctx.save();
    ctx.fillStyle = "#ff6f61";
    ctx.shadowColor = "rgba(255, 111, 97, 0.5)";
    ctx.shadowBlur = 14;

    const segments = 4;
    const width = tileSize / segments;

    for (let i = 0; i < segments; i += 1) {
      const left = x + i * width;
      ctx.beginPath();
      ctx.moveTo(left, y + tileSize - 6);
      ctx.lineTo(left + width / 2, y + 6);
      ctx.lineTo(left + width, y + tileSize - 6);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  function drawSpawn(x, y) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 209, 102, 0.16)";
    roundRect(ctx, x + 4, y + 4, tileSize - 8, tileSize - 8, 12);
    ctx.fill();
    ctx.restore();
  }

  function drawGoalTile(x, y) {
    ctx.save();
    ctx.strokeStyle = "rgba(125, 242, 211, 0.75)";
    ctx.lineWidth = 2;
    roundRect(ctx, x + 5, y + 5, tileSize - 10, tileSize - 10, 10);
    ctx.stroke();
    ctx.restore();
  }

  function drawGoalPulse(level) {
    const pulse = 0.65 + Math.sin(performance.now() * 0.006) * 0.2;
    const x = (level.goal.x + 0.5) * tileSize;
    const y = (level.goal.y + 0.5) * tileSize;

    ctx.save();
    ctx.strokeStyle = `rgba(125, 242, 211, ${pulse})`;
    ctx.fillStyle = "rgba(125, 242, 211, 0.22)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 11 + pulse * 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawBall() {
    if (!state.ball) {
      return;
    }

    const ball = state.ball;
    const stretchX = 1 + ball.squash * (Math.abs(state.gravity.x) ? 0.8 : 0.2);
    const stretchY = 1 + ball.squash * (Math.abs(state.gravity.y) ? 0.8 : 0.2);

    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.scale(stretchX, stretchY);
    ctx.shadowColor = "rgba(255, 185, 76, 0.42)";
    ctx.shadowBlur = 18;

    const gradient = ctx.createRadialGradient(-4, -4, 2, 0, 0, ball.radius * 1.1);
    gradient.addColorStop(0, "#fff7ca");
    gradient.addColorStop(1, "#ffb84c");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(-ball.radius * 0.35, -ball.radius * 0.35, ball.radius * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    state.particles.forEach((particle) => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, particle.life * 1.8);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawGravityArrow(level) {
    const size = 18;
    const x = level.worldWidth - 54;
    const y = 28;

    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "rgba(255,255,255,0.82)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (state.gravity.dir === "left") {
      ctx.rotate(-Math.PI / 2);
    } else if (state.gravity.dir === "up") {
      ctx.rotate(Math.PI);
    } else if (state.gravity.dir === "right") {
      ctx.rotate(Math.PI / 2);
    }

    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(0, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8, size - 8);
    ctx.lineTo(0, size);
    ctx.lineTo(8, size - 8);
    ctx.stroke();
    ctx.restore();
  }

  function drawFlash(level) {
    if (state.flashAlpha <= 0) {
      return;
    }

    ctx.save();
    ctx.fillStyle = `rgba(125, 242, 211, ${state.flashAlpha})`;
    ctx.fillRect(0, 0, level.worldWidth, level.worldHeight);
    ctx.restore();
  }

  function roundRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function loop(timestamp) {
    if (!state.lastTimestamp) {
      state.lastTimestamp = timestamp;
    }

    const deltaMs = timestamp - state.lastTimestamp;
    state.lastTimestamp = timestamp;

    update(deltaMs, timestamp);
    render();
    requestAnimationFrame(loop);
  }

  function handleKeydown(event) {
    const key = event.key.toLowerCase();
    const mapping = {
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right"
    };

    const direction = mapping[key];
    if (!direction) {
      return;
    }

    event.preventDefault();
    setGravity(direction);
  }

  document.getElementById("startButton").addEventListener("click", startGame);
  document.getElementById("restartButton").addEventListener("click", () => {
    if (!state.started) {
      startGame();
      return;
    }

    resetLevel(false);
  });
  document.getElementById("menuButton").addEventListener("click", goToMenu);
  document.getElementById("nextButton").addEventListener("click", () => {
    hideFinish();
    nextLevel();
  });

  document.querySelectorAll(".gravity-button").forEach((button) => {
    button.addEventListener("click", () => {
      setGravity(button.dataset.dir);
    });
  });

  window.addEventListener("keydown", handleKeydown, { passive: false });

  resetLevel(true);
  setStatus("先试试方向键，或者点击下面的重力按钮。");
  render();
  requestAnimationFrame(loop);
})();
