const { ipcRenderer } = require('electron');
const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

// --- 状態管理 ---
let currentSpeakerUuid = "3c37646f-3881-5374-2a83-149267990abc";
let currentStyleId = 0;

// DOM要素
const statusText = document.getElementById('status');
const modal = document.getElementById('characterModal');
const currentSpeakerImg = document.getElementById('currentSpeakerImg');
const currentSpeakerName = document.getElementById('currentSpeakerName');
const speakerWrapper = document.getElementById('speakerWrapper');
const pinBtn = document.getElementById('pinBtn');

// --- ウィンドウ操作 ---
document.getElementById('minBtn').onclick = () => ipcRenderer.send('window-minimize');
document.getElementById('closeBtn').onclick = () => ipcRenderer.send('window-close');
document.getElementById('settingBtn').onclick = () => ipcRenderer.send('select-exe');
document.getElementById('aboutBtn').onclick = () => ipcRenderer.send('open-about');

pinBtn.onclick = () => {
    ipcRenderer.send('toggle-always-on-top');
};

ipcRenderer.on('always-on-top-status', (event, isPinned) => {
    if (isPinned) {
        pinBtn.style.color = "#10b981"; // 固定時は緑色に光らせる
        pinBtn.style.opacity = "1";
    } else {
        pinBtn.style.color = "#888";    // 通常時は他のボタンと同じグレー
        pinBtn.style.opacity = "0.7";
    }
});

// --- キャラクター情報ロード ---
async function loadSpeakerInfo() {
    try {
        const res = await axios.get('http://127.0.0.1:50032/v1/speakers_path_variant');
        const speaker = res.data.find(s => s.speakerUuid === currentSpeakerUuid);
        if (speaker) {
            const style = speaker.styles.find(s => s.styleId === currentStyleId);
            if (style) {
                const imgPath = speaker.pathPortrait ? `file:///${speaker.pathPortrait.replace(/\\/g, '/')}` : "";
                if (currentSpeakerImg && imgPath) {
                    currentSpeakerImg.src = imgPath;
                    currentSpeakerImg.style.display = 'block';
                }
                if (currentSpeakerName) {
                    currentSpeakerName.innerText = `${speaker.speakerName} (${style.styleName})`;
                }
                return true;
            }
        }
    } catch (e) { return false; }
    return false;
}

function autoRetryLoad() {
    const timer = setInterval(async () => {
        if (await loadSpeakerInfo()) {
            clearInterval(timer);
            statusText.innerText = "Engine Connected";
        }
    }, 2000);
}

// 起動時にリトライ開始
window.onload = autoRetryLoad;

document.getElementById('launchBtn').onclick = () => {
    ipcRenderer.send('launch-engine');
    statusText.innerText = "Starting Engine...";
    autoRetryLoad();
};

// --- キャラクター選択モーダル ---
document.getElementById('characterBtn').onclick = async () => {
    modal.style.display = 'flex';
    const grid = document.getElementById('characterGrid');
    grid.innerHTML = '<div style="color:#888; text-align:center; grid-column:1/-1;">Loading...</div>';
    try {
        const res = await axios.get('http://127.0.0.1:50032/v1/speakers_path_variant');
        grid.innerHTML = '';
        res.data.forEach(speaker => {
            speaker.styles.forEach(style => {
                const card = document.createElement('div');
                card.style = "background:#2a2a2a; padding:10px; border-radius:12px; cursor:pointer; text-align:center; border:1px solid #444;";
                const listImg = speaker.pathPortrait ? `file:///${speaker.pathPortrait.replace(/\\/g, '/')}` : "";
                card.innerHTML = `<img src="${listImg}" style="width:60px; height:60px; object-fit:contain;"><div style="font-size:11px; font-weight:bold; color:#fff; margin-top:5px;">${speaker.speakerName}</div><div style="font-size:10px; color:#10b981;">${style.styleName}</div>`;
                
                card.onclick = () => {
                    currentSpeakerUuid = speaker.speakerUuid;
                    currentStyleId = style.styleId;
                    currentSpeakerImg.src = listImg;
                    currentSpeakerName.innerText = `${speaker.speakerName} (${style.styleName})`;
                    modal.style.display = 'none'; // 選択したら閉じる
                };
                grid.appendChild(card);
            });
        });
    } catch (e) { grid.innerHTML = "Error: Engine not running"; }
};

document.getElementById('closeModal').onclick = () => modal.style.display = 'none';

// --- 音声合成 ---
document.getElementById('speakBtn').onclick = async () => {
    const text = document.getElementById('inputText').value;
    if (!text) return;
    statusText.innerText = "Generating...";
    try {
        const res = await axios.post('http://localhost:50032/v1/synthesis', {
            text, speakerUuid: currentSpeakerUuid, styleId: currentStyleId,
            speedScale: 1.0, volumeScale: 1.0, pitchScale: 0.0, intonationScale: 1.0,
            prePhonemeLength: 0.1, postPhonemeLength: 0.1, outputSamplingRate: 44100
        }, { responseType: 'arraybuffer' });

        const tempFile = path.join(__dirname, 'temp_voice.wav');
        fs.writeFileSync(tempFile, Buffer.from(res.data));
        statusText.innerText = "Playing...";
        speakerWrapper.classList.add('is-speaking');
        
        exec(`ffplay -nodisp -autoexit "${tempFile}"`, () => {
            speakerWrapper.classList.remove('is-speaking');
            statusText.innerText = "Standby";
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        });
    } catch (e) { statusText.innerText = "Engine Error"; }
};