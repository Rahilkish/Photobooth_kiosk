// --- PHOTOBOOTH STALL PROJECT CONFIG ---
const PRINTER_IP = "10.54.210.37"; 
const PRINTER_PORT = "3000";

// --- CLOUDINARY CONFIG ---
const CLOUD_NAME = "dcnmfed2j"; 
const UPLOAD_PRESET = "Kiosk_Uploads"; 

let socket;
let isConnected = false;
let capture;
let stripBuffer;
let cloudBuffer;
let photos = [];
let stage = 'IDLE'; 
let timer = 3;
let snapCount = 0;
let lastTime = 0;
let flashAlpha = 0;
let isReadyPhase = true; 
let retakeUsed = false; 

// --- QR CODE & TIMER VARIABLES ---
let qrImage = null;
let isUploading = false;
let uploadError = false;
let qrTimer = 30; 
let qrLastTime = 0; 

// --- THEME & COLORS ---
let themeColor = "#FF528B"; 
let cardColor = "#FFFFFF";  
let textColor = "#000000";

// --- DESIGN CONFIG ---
let targetRatio = 3/2; 
let stripY = -650;    
let targetY = -120;   
let slotW = 280;      
let slotH = 22;       
let animSpeed = 0.06; 

let activeFilter = 'none';   
let filterButtons = [
  { label: 'Normal', type: 'none' },
  { label: 'BW', type: 'grayscale(1)' },
  { label: 'Sepia', type: 'sepia(1)' },
  { label: 'Bright', type: 'contrast(1.2) brightness(1.1)' }
];

let activeColor = '#ffffff'; 

function setup() {
  createCanvas(windowWidth, windowHeight);
  socket = io(`http://${PRINTER_IP}:${PRINTER_PORT}`);
  socket.on('connect', () => { isConnected = true; });
  socket.on('connect_error', () => { isConnected = false; });

  let constraints = { 
    video: { width: { ideal: 4096 }, height: { ideal: 2160 }, facingMode: "user" }, 
    audio: false 
  };
  capture = createCapture(constraints);
  capture.hide();
  
  stripBuffer = createGraphics(1200, 3600); 
  stripBuffer.pixelDensity(1); 
  
  cloudBuffer = createGraphics(1080, 1920);
  cloudBuffer.pixelDensity(1);
}

function draw() {
  drawGradientBackground();

  let cx = width / 2;
  let cy = height / 2; 

  noStroke();
  fill(isConnected ? '#4CD964' : '#FF3B30');
  ellipse(30, 30, 12, 12);

  if (stage === 'IDLE' || stage === 'COUNTDOWN' || stage === 'PAUSE') {
    drawBoothLayout();
    if (flashAlpha > 0) { drawFlashEffect(); flashAlpha -= 25; }
  } else if (stage === 'DEVELOPING') {
    drawDoodleTransition(cx, cy);
  } else if (stage === 'SELECT') {
    drawEditorLayout();
  } else if (stage === 'PRINTING') {
    drawPrintingUI();
  }
}

function drawGradientBackground() {
  let c1 = color(255, 255, 255); 
  let c2 = color(242, 244, 246); 
  
  noFill();
  for (let y = 0; y <= height; y++) {
    let inter = map(y, 0, height, 0, 1);
    let c = lerpColor(c1, c2, inter);
    stroke(c);
    line(0, y, width, y);
  }
}

function drawPrintingUI() {
  let cx = width / 2;
  let cy = height / 2;
  
  let pulse = 150 + sin(millis() * 0.005) * 105;
  
  textAlign(CENTER, CENTER);
  
  fill(0);
  textStyle(BOLD);
  textSize(44);
  text("Printing your memories...", cx, cy - 200);
  
  textStyle(NORMAL);
  textSize(22);
  fill(80, pulse); 
  text("Please collect your prints in 2 mins", cx, cy - 155);
  
  if (isUploading) {
    fill(themeColor);
    textSize(19);
    textStyle(BOLD);
    text("Generating your digital copy... ☁️", cx, cy - 15);
    textStyle(NORMAL);
  } else if (uploadError) {
    if (millis() - qrLastTime >= 1000) { qrTimer--; qrLastTime = millis(); if (qrTimer <= 0) resetBooth(); }
    
    fill('#FF3B30');
    textSize(19);
    text(`Oops, couldn't connect. Resetting in ${qrTimer}s...`, cx, cy - 15);
  } else if (qrImage) {
    if (millis() - qrLastTime >= 1000) { qrTimer--; qrLastTime = millis(); if (qrTimer <= 0) resetBooth(); }

    fill(255);
    noStroke();
    drawingContext.shadowBlur = 30;
    drawingContext.shadowColor = 'rgba(0,0,0,0.1)';
    rect(cx - 100, cy - 110, 200, 200, 20);
    drawingContext.shadowBlur = 0;
    
    image(qrImage, cx - 90, cy - 100, 180, 180);
    
    textSize(17);
    fill(themeColor);
    textStyle(BOLD);
    text(`Scan to download! (${qrTimer}s) 📸`, cx, cy + 120);
    textStyle(NORMAL);
  }

  let btnW = 190;
  let btnH = 55;
  let bx = cx - btnW/2;
  let by = cy + 165;
  
  drawingContext.shadowBlur = 15;
  drawingContext.shadowColor = 'rgba(255, 82, 139, 0.3)';
  fill(themeColor);
  noStroke();
  rect(bx, by, btnW, btnH, 28);
  drawingContext.shadowBlur = 0;
  
  fill(255);
  textSize(19);
  textStyle(BOLD);
  text("DONE", cx, by + btnH/2);
  textStyle(NORMAL);

  textSize(17);
  fill(100); 
  text("Choose a surprise at the counter 🎟️", cx, cy + 255);
}

function drawBoothLayout() {
  let camW = min(width * 0.44, 620); 
  let camH = camW / targetRatio; 
  let camX = (width * 0.62 - camW) / 2; 
  let camY = height * 0.10; 

  drawingContext.shadowBlur = 25;
  drawingContext.shadowColor = 'rgba(0,0,0,0.1)';
  fill(cardColor);
  noStroke();
  rect(camX - 10, camY - 10, camW + 20, camH + 20, 24);
  drawingContext.shadowBlur = 0;
  
  if (capture.loadedmetadata) {
    push();
    translate(camX + camW, camY);
    scale(-1, 1); 
    let sH = capture.height;
    let sW = sH * targetRatio;
    let sX = (capture.width - sW) / 2; 
    drawingContext.filter = activeFilter;
    drawingContext.save();
    beginShape();
    vertex(camW, 0); vertex(0, 0); vertex(0, camH); vertex(camW, camH);
    endShape(CLOSE);
    image(capture, 0, 0, camW, camH, sX, 0, sW, sH);
    drawingContext.restore();
    pop();
  }

  if (stage === 'IDLE') {
    drawFilterPills(camX, camY + camH + 45, camW);
    drawStartButton(camX, camY + camH + 125, camW);
  }

  if (stage === 'COUNTDOWN') {
    drawCountdownUI(camX, camY, camW, camH);
    handleSequence();
  }
  
  drawStripByContext(width * 0.81, height * 0.05, width * 0.145, height * 0.9, 0.88, '#ffffff', "LIVE_SIDEBAR");
}

function drawDoodleTransition(cx, cy) {
  stripY += (targetY - stripY) * animSpeed;
  
  let breathe = 180 + sin(millis() * 0.005) * 75; 
  fill(0, breathe); 
  noStroke();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(30);
  text("Developing your frames...", cx, cy - 190); 
  textStyle(NORMAL);

  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(0, cy, width, height - cy); 
  drawingContext.clip();

  push();
  translate(cx, cy + stripY);

  drawingContext.shadowBlur = 45; 
  drawingContext.shadowColor = 'rgba(0, 0, 0, 0.4)'; 
  drawingContext.shadowOffsetY = 15; 

  fill(255);
  stroke(200); 
  strokeWeight(1);
  rect(-slotW/2, 0, slotW, 750, 15);

  drawingContext.shadowBlur = 0;
  drawingContext.shadowOffsetY = 0;
  
  let imgW = slotW * 0.88;
  let imgH = imgW / targetRatio;
  fill(245);
  noStroke();
  for (let i = 0; i < 4; i++) {
    rect(-imgW/2, 35 + (i * (imgH + 12)), imgW, imgH);
  }
  pop();
  
  drawingContext.restore(); 

  stroke(180); 
  strokeWeight(4);
  noFill();
  rect(cx - slotW/2, cy, slotW, slotH, 5); 

  if (abs(targetY - stripY) < 1.0) stage = 'SELECT';
}

function drawEditorLayout() {
  let pH = min(height * 0.88, 820); 
  let pW = pH * (340 / 920); 
  let pX = (width * 0.42) - (pW / 2); 
  let pY = (height - pH) / 2;
  
  drawStripByContext(pX, pY, pW, pH, 0.88, activeColor, "EDITOR_PREVIEW");
  drawLightEditorUI();
}

function drawLightEditorUI() {
  let uiX = width * 0.68;
  let uiY = height * 0.10; 
  let panelH = min(height * 0.72, 540);
  
  fill(255);
  drawingContext.shadowBlur = 40;
  drawingContext.shadowColor = 'rgba(0,0,0,0.08)'; 
  rect(uiX - 30, uiY, 310, panelH, 35); 
  drawingContext.shadowBlur = 0;

  fill(0);
  textAlign(LEFT, TOP);
  textSize(17);
  textStyle(BOLD);
  text("STYLE YOUR STRIP", uiX, uiY + 30);
  
  let colors = [
    '#000000', '#1C2A44', '#6E1F2A', 
    '#FFFFFF', '#F6E58D', '#BFD7ED', '#FFD4DD'
  ];
  let labels = [
    'Midnight Black', 'Deep Navy', 'Crimson Red', 
    'Pure White', 'Pale Lemon', 'Sky Blue', 'Blush Pink'
  ];
  
  let itemSpacing = (panelH - 100) / 7;
  for (let i = 0; i < 7; i++) {
    let sx = uiX + 22;
    let sy = uiY + 75 + (i * itemSpacing); 
    let isSelected = activeColor === colors[i];
    
    if (isSelected) {
      noFill();
      stroke(themeColor);
      strokeWeight(3);
      ellipse(sx, sy, 46, 46); 
    }
    
    noStroke();
    fill(colors[i]);
    stroke(230); 
    strokeWeight(1);
    ellipse(sx, sy, 36, 36); 
    
    noStroke();
    fill(isSelected ? themeColor : 100);
    textAlign(LEFT, CENTER);
    textSize(15);
    text(labels[i], sx + 38, sy);
  }

  let btnY1 = uiY + panelH + 15;
  let btnY2 = btnY1 + 60;

  if (!retakeUsed) {
    fill(255);
    stroke(themeColor);
    strokeWeight(2);
    rect(uiX - 5, btnY1, 250, 58, 28);
    fill(themeColor);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(17);
    textStyle(BOLD);
    text("RETAKE PHOTOS", uiX + 120, btnY1 + 29);
    textStyle(NORMAL);
  }
  
  fill(themeColor);
  noStroke();
  rect(uiX - 5, btnY2, 250, 58, 28);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(19);
  textStyle(BOLD);
  text("FINISH & PRINT", uiX + 120, btnY2 + 29);
  textStyle(NORMAL);
}

function drawStripByContext(x, y, w, h, photoScale, currentBg, context) {
  let isSecondary = (context === "EDITOR_PREVIEW");
  let isLiveSidebar = (context === "LIVE_SIDEBAR");

  if (isSecondary) {
    drawingContext.shadowBlur = 45; 
    drawingContext.shadowColor = 'rgba(0, 0, 0, 0.4)'; 
    drawingContext.shadowOffsetY = 15; 
  }

  fill(currentBg);
  if(currentBg === '#FFFFFF' || currentBg === '#ffffff') { stroke(230); strokeWeight(1); } else { noStroke(); }
  
  rect(x, y, w, h, 15);

  if (isSecondary) {
    drawingContext.shadowBlur = 0;
    drawingContext.shadowOffsetY = 0;
  }
  
  let imgW = w * photoScale;
  let imgH = imgW / targetRatio; 
  
  let topMargin = isSecondary ? h * 0.025 : h * 0.04; 
  let gap = isSecondary ? h * 0.003 : h * 0.01; 

  for (let i = 0; i < 4; i++) {
    let imgY = y + topMargin + (i * (imgH + gap)); 
    fill(245);
    noStroke();
    rect(x + (w - imgW) / 2, imgY, imgW, imgH);
    
    if (photos[i]) {
      if (isLiveSidebar) {
        push();
        translate(x + (w - imgW) / 2 + imgW, imgY);
        scale(-1, 1); 
        image(photos[i], 0, 0, imgW, imgH);
        pop();
      } else {
        image(photos[i], x + (w - imgW) / 2, imgY, imgW, imgH);
      }
    }
  }
  
  let isDarkBg = (currentBg === '#000000' || currentBg === '#1C2A44' || currentBg === '#6E1F2A');
  fill(isDarkBg ? 255 : 20);
  
  textAlign(RIGHT, BOTTOM);
  textStyle(BOLD);
  textSize(isSecondary ? w * 0.055 : w * 0.09); 
  text("THE\nPOLAROID\nCLUB", x + w - (w * 0.1), y + h - (isSecondary ? h * 0.015 : h * 0.04));
  textStyle(NORMAL);
}

function resetBooth() {
  stage = 'IDLE'; 
  photos = []; 
  isReadyPhase = true; 
  stripY = -650;
  retakeUsed = false; 
  qrImage = null;
  isUploading = false;
  qrTimer = 30; 
}

function finishSession() {
  stripBuffer.background(activeColor);
  let w = stripBuffer.width; let h = stripBuffer.height;
  let imgW = w * 0.90; let imgH = imgW / targetRatio;
  let pngTopMargin = 120; let pngGap = 55; 
  
  for (let i = 0; i < photos.length; i++) {
    let imgY = pngTopMargin + (i * (imgH + pngGap)); 
    stripBuffer.image(photos[i], (w - imgW) / 2, imgY, imgW, imgH);
  }
  
  let isDarkBg = (activeColor === '#000000' || activeColor === '#1C2A44' || activeColor === '#6E1F2A');
  stripBuffer.fill(isDarkBg ? 255 : 20);
  stripBuffer.textAlign(RIGHT, BOTTOM); stripBuffer.textStyle(BOLD);
  stripBuffer.textSize(85); stripBuffer.text("THE\nPOLAROID\nCLUB", w - 80, h - 100); 
  
  socket.emit('send-strip', { image: stripBuffer.canvas.toDataURL('image/jpeg', 0.9) });
  saveCanvas(stripBuffer, "Photobooth_Stall_Project", "png");

  stage = 'PRINTING'; 

  if (CLOUD_NAME && UPLOAD_PRESET) {
    isUploading = true;
    qrImage = null;
    uploadError = false;

    cloudBuffer.background('#FFE4E1'); 
    
    let cbW = cloudBuffer.width;
    let cbH = cloudBuffer.height;
    let pTop = 150; 
    let pBottom = 150;
    let scaledH = cbH - pTop - pBottom; 
    let scaledW = scaledH / 3; 

    cloudBuffer.drawingContext.shadowBlur = 50;
    cloudBuffer.drawingContext.shadowColor = 'rgba(0,0,0,0.3)';
    cloudBuffer.drawingContext.shadowOffsetY = 20;
    
    cloudBuffer.image(stripBuffer, (cbW - scaledW)/2, pTop, scaledW, scaledH);
    
    cloudBuffer.drawingContext.shadowBlur = 0;
    cloudBuffer.drawingContext.shadowOffsetY = 0;

    let webImage = cloudBuffer.canvas.toDataURL('image/jpeg', 0.60);
    
    let url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
    let formData = new FormData();
    formData.append('file', webImage);
    formData.append('upload_preset', UPLOAD_PRESET);

    fetch(url, { method: 'POST', body: formData })
      .then(response => response.json())
      .then(data => {
        if(data.secure_url) {
          let qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(data.secure_url)}`;
          qrImage = loadImage(qrUrl, () => {
             isUploading = false;
             qrTimer = 30; 
             qrLastTime = millis();
          });
        } else {
          uploadError = true; isUploading = false;
          qrTimer = 8; qrLastTime = millis();
        }
      })
      .catch(err => {
        console.error("Cloudinary Upload Error:", err);
        uploadError = true; isUploading = false;
        qrTimer = 8; qrLastTime = millis();
      });
  } else {
    uploadError = true; isUploading = false;
    qrTimer = 10; qrLastTime = millis();
  }
}

function drawFilterPills(x, y, w) {
  let gap = 14; let btnW = (w - (gap * 3)) / 4; let btnH = 45;
  textAlign(CENTER, CENTER); textSize(15); textStyle(BOLD); fill(0); text("Choose a filter", x + w/2, y - 22);
  for (let i = 0; i < filterButtons.length; i++) {
    let bx = x + (i * (btnW + gap)); let isSelected = activeFilter === filterButtons[i].type;
    if (isSelected) { drawingContext.shadowBlur = 15; drawingContext.shadowColor = 'rgba(255, 82, 139, 0.4)'; fill(themeColor); noStroke(); rect(bx, y, btnW, btnH, 22); drawingContext.shadowBlur = 0; fill(255); } 
    else { fill(255); stroke(0); strokeWeight(2); rect(bx, y, btnW, btnH, 22); fill(0); }
    noStroke(); text(filterButtons[i].label, bx + btnW/2, y + btnH/2);
  } textStyle(NORMAL);
}

function drawStartButton(x, y, w) {
  let btnW = w * 0.65; let btnH = 68; let bx = x + (w - btnW) / 2;
  drawingContext.shadowBlur = 20; drawingContext.shadowColor = 'rgba(255, 82, 139, 0.3)';
  fill(themeColor); noStroke(); rect(bx, y, btnW, btnH, 35); drawingContext.shadowBlur = 0;
  fill(255); textAlign(CENTER, CENTER); textSize(22); textStyle(BOLD); text("Start Capture", bx + btnW/2, y + btnH/2); textStyle(NORMAL);
}

function drawCountdownUI(x, y, w, h) {
  textAlign(CENTER, CENTER);
  
  drawingContext.shadowBlur = 15;
  drawingContext.shadowColor = 'rgba(0, 0, 0, 0.8)';
  
  if (isReadyPhase && snapCount === 0) { 
    fill(themeColor); 
    textSize(w * 0.12); 
    text("READY?", x + w/2, y + h/2); 
  } else { 
    fill(255); 
    textSize(w * 0.25); 
    text(timer, x + w/2, y + h/2); 
  }
  
  drawingContext.shadowBlur = 0;
}

function handleSequence() {
  if (millis() - lastTime >= 1000) { if (isReadyPhase && snapCount === 0) { isReadyPhase = false; } else { timer--; } lastTime = millis(); }
  if (timer <= 0) {
    flashAlpha = 255; let sH = capture.height; let sW = sH * targetRatio; let sX = (capture.width - sW) / 2;
    let pg = createGraphics(sW, sH); pg.drawingContext.filter = activeFilter;
    pg.image(capture, 0, 0, sW, sH, sX, 0, sW, sH); photos.push(pg); snapCount++;
    if (snapCount < 4) { stage = 'PAUSE'; setTimeout(() => { stage = 'COUNTDOWN'; timer = 3; lastTime = millis(); }, 1000); }
    else { stage = 'DEVELOPING'; }
  }
}

function drawFlashEffect() { fill(255, flashAlpha); rect(0, 0, width, height); }

function mousePressed() {
  let cx = width / 2;
  let cy = height / 2;

  if (stage === 'PRINTING') {
    let btnW = 190;
    let btnH = 55;
    let bx = cx - btnW/2;
    let by = cy + 165; 
    if (mouseX > bx && mouseX < bx + btnW && mouseY > by && mouseY < by + btnH) {
      resetBooth(); 
      return;
    }
  }

  let camW = min(width * 0.44, 620); let camH = camW / targetRatio;
  let camX = (width * 0.62 - camW) / 2; let camY = height * 0.10;
  
  if (stage === 'IDLE') {
    let gap = 14; let btnW = (camW - (gap * 3)) / 4; 
    let fy = camY + camH + 45; 
    for (let i = 0; i < filterButtons.length; i++) {
      let bx = camX + (i * (btnW + gap));
      if (mouseX > bx && mouseX < bx + btnW && mouseY > fy && mouseY < fy + 45) { activeFilter = filterButtons[i].type; return; }
    }
    let sBtnW = camW * 0.65; let sBtnH = 68; 
    let sBx = camX + (camW - sBtnW) / 2; 
    let sBy = camY + camH + 125; 
    if (mouseX > sBx && mouseX < sBx + sBtnW && mouseY > sBy && mouseY < sBy + sBtnH) { stage = 'COUNTDOWN'; photos = []; snapCount = 0; timer = 3; isReadyPhase = true; lastTime = millis(); }
  }
  
  if (stage === 'SELECT') {
    let uiX = width * 0.68;
    let uiY = height * 0.10;
    let panelH = min(height * 0.72, 540);
    let itemSpacing = (panelH - 100) / 7;
    let colors = ['#000000', '#1C2A44', '#6E1F2A', '#FFFFFF', '#F6E58D', '#BFD7ED', '#FFD4DD'];
    
    for (let i=0; i<7; i++) {
      let sx = uiX + 22; 
      let sy = uiY + 75 + (i * itemSpacing);
      if(dist(mouseX, mouseY, sx, sy) < 22) activeColor = colors[i];
    }
    
    let btnY1 = uiY + panelH + 15;
    let btnY2 = btnY1 + 60;

    if(!retakeUsed && mouseX > uiX - 5 && mouseX < uiX + 245 && mouseY > btnY1 && mouseY < btnY1 + 58) {
      retakeUsed = true; 
      stage = 'COUNTDOWN'; 
      photos = []; 
      snapCount = 0; 
      timer = 3; 
      isReadyPhase = true; 
      lastTime = millis(); 
      stripY = -650; 
      return; 
    }

    if(mouseX > uiX - 5 && mouseX < uiX + 245 && mouseY > btnY2 && mouseY < btnY2 + 58) finishSession();
  }
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
