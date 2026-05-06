(function () {
  "use strict";

  const CONFIG = {
    appName: "Elite Turbo",
    storageKey: "vsh_license_key",
    storageDevice: "vsh_license_device",
    checkUrl: "/check",   
    activateUrl: "/activate", 
    contactUrl: "https://zalo.me/0792822868",
    timezone: "Asia/Ho_Chi_Minh",
    autoCheckOnLoad: false, 
    relockWhenInvalid: true,
  };

  const state = { key: "", deviceId: "", verified: false, expiresAt: "", mounted: false };

  function qs(sel) { return document.querySelector(sel); }
  function ce(tag, props = {}, html = "") { const el = document.createElement(tag); Object.assign(el, props); if (html) el.innerHTML = html; return el; }
  function escapeHtml(str) { return String(str ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  function formatDateVN(value) {
    if (!value) return "VĨNH VIỄN";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: CONFIG.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).format(d).replace(',', ' //');
  }

  function toast(message, type = "ok", raw = null) {
    let box = qs("#vgMsgToast");
    if (!box) {
        box = ce("div", {id: "vgMsgToast"});
        box.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:9999; padding:12px 20px; border-radius:8px; font-weight:bold; font-family:'Space Grotesk', monospace; font-size:12px; transition:0.3s; opacity:0; pointer-events:none; text-align:center;";
        document.body.appendChild(box);
    }
    
    if(type === "ok") { box.style.background = "rgba(0,255,136, 0.1)"; box.style.color = "#00ff88"; box.style.border = "1px solid rgba(0,255,136, 0.3)"; box.style.boxShadow = "0 0 15px rgba(0,255,136, 0.1)"; }
    else if(type === "err") { box.style.background = "rgba(255,51,51, 0.1)"; box.style.color = "#ff3333"; box.style.border = "1px solid rgba(255,51,51, 0.3)"; box.style.boxShadow = "0 0 15px rgba(255,51,51, 0.1)"; }
    else { box.style.background = "rgba(255,184,0, 0.1)"; box.style.color = "#ffb800"; box.style.border = "1px solid rgba(255,184,0, 0.3)"; box.style.boxShadow = "0 0 15px rgba(255,184,0, 0.1)"; }

    box.innerHTML = message;
    box.style.opacity = "1";
    setTimeout(() => { box.style.opacity = "0"; }, 3000);
    if(raw) console.log("[Elite Turbo]:", raw);
  }

  function getOrCreateDeviceId() {
    let id = localStorage.getItem(CONFIG.storageDevice);
    if (id) return id;
    if (window.crypto?.randomUUID) { id = crypto.randomUUID().toUpperCase(); } else { id = "SYS-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 10).toUpperCase(); }
    localStorage.setItem(CONFIG.storageDevice, id); return id;
  }

function saveKey(key) { localStorage.setItem(CONFIG.storageKey, key); state.key = key; }
  function clearKey() { localStorage.removeItem(CONFIG.storageKey); state.key = ""; }
  function loadSavedKey() { state.key = localStorage.getItem(CONFIG.storageKey) || ""; return state.key; }

  function dispatchLicenseChange(detail) { window.dispatchEvent(new CustomEvent("vsh-license-change", { detail })); }

  function controlDoors(isOpen, instant = false) {
      const gate = qs("#vgGate");
      if (!gate) return;
      let doorWrap = qs(".cyber-door-wrap");
      if (!doorWrap) {
         doorWrap = ce("div", {className: "cyber-door-wrap is-closed"}, `
           <div class="c-door-left"><i class="fas fa-fingerprint door-icon-left"></i></div>
           <div class="c-door-right"><i class="fas fa-lock door-icon-right"></i></div>
         `);
         gate.appendChild(doorWrap);
      }

      const left = qs(".c-door-left", doorWrap);
      const right = qs(".c-door-right", doorWrap);

      if (instant) {
          left.style.transition = 'none'; right.style.transition = 'none';
      } else {
          left.style.transition = ''; right.style.transition = '';
      }

      if (isOpen) { doorWrap.classList.remove("is-closed"); } 
      else { doorWrap.classList.add("is-closed"); }
      
      void doorWrap.offsetWidth;
  }

  function lockUI() {
    document.body.classList.add("vg-locked");
    const gate = qs("#vgGate"); const panel = qs("#main-panel"); const intro = qs("#home-intro");
    if (intro) intro.style.display = "none";
    if (panel) panel.style.display = "none";
    
    if (gate) {
      gate.style.display = "flex"; gate.style.opacity = "1";
      const loginPanel = qs('#vgGate .vg-container');
      if (loginPanel) { loginPanel.style.display = 'flex'; loginPanel.style.opacity = '1'; }
      
      const doorWrap = qs(".cyber-door-wrap");
      if (doorWrap) doorWrap.style.display = 'none';
    }
  }

function unlockUI(isAutoBoot) {
    const gate = qs("#vgGate"); const intro = qs("#home-intro"); 
    const loginPanel = qs('#vgGate .vg-container');

    if (gate && intro) {
      if (isAutoBoot) {
          gate.style.display = 'none'; intro.style.display = "flex"; document.body.classList.remove("vg-locked");
      } else {
          if (loginPanel) { loginPanel.style.transition = 'opacity 0.4s ease'; loginPanel.style.opacity = '0'; }

          setTimeout(() => {
              gate.style.transition = "opacity 0.5s ease";
              gate.style.opacity = "0";
              
              setTimeout(() => {
                  gate.style.display = "none";
                  intro.style.display = "flex"; 
                  document.body.classList.remove("vg-locked");

                  if (loginPanel) { loginPanel.style.display = 'flex'; loginPanel.style.opacity = '1'; }
                  gate.style.opacity = "1";
              }, 500); 
          }, 400); 
      }
    }
  }

  function startModalAuth(apiTask, completionCallback, inputKey) {
      const modalOverlay = qs("#auth-modal-overlay");
      const progressPanel = qs("#auth-progress");
      const resultPanel = qs("#auth-result");
      const s1 = qs("#step-1"); const s2 = qs("#step-2"); const s3 = qs("#step-3");
      
      modalOverlay.style.display = "flex";
      progressPanel.style.display = "block";
      resultPanel.style.display = "none";
      s1.className = "auth-step active"; s2.className = "auth-step"; s3.className = "auth-step";


      if(window.startLoadingSound) window.startLoadingSound();

      let apiResult = null;
      let apiFinished = false;

      apiTask().then(res => { apiResult = res; apiFinished = true; });


      setTimeout(() => {
          s1.className = "auth-step success"; s2.className = "auth-step active";
          
          let checkInterval = setInterval(() => {
              if(apiFinished) {
                  clearInterval(checkInterval);
     
                  if(window.stopLoadingSound) window.stopLoadingSound();

                  if (apiResult && apiResult.ok) {
                      s2.className = "auth-step success"; s3.className = "auth-step active";
                      setTimeout(() => {
                          s3.className = "auth-step success";
                          setTimeout(() => showModalResult(true, apiResult, inputKey, completionCallback), 150);
                      }, 150); 
                  } else {
                      s2.className = "auth-step"; s2.style.borderColor = "rgba(255,0,51,0.5)";
                      setTimeout(() => showModalResult(false, apiResult, inputKey, completionCallback), 150);
                  }
              }
          }, 100);
      }, 300);
  }

  function showModalResult(isSuccess, result, key, completionCallback) {
      qs("#auth-progress").style.display = "none";
      qs("#auth-result").style.display = "block";
      
      const icon = qs("#res-icon"); const badge = qs("#res-badge"); const title = qs("#res-title");
      const desc = qs("#res-desc"); const keyDisp = qs("#res-key-text"); const btnGroup = qs("#res-btn-group");

      keyDisp.innerText = `Key: ${key}`;

      if (isSuccess) {
          icon.innerHTML = `<i class="fas fa-check" style="color:#00ff88;"></i>`; icon.style.borderColor = "#00ff88";
          badge.innerHTML = "● XÁC THỰC HOÀN TẤT"; badge.style.color = "#00ff88";
          title.innerText = "Đăng Nhập Thành Công";
          
          let expText = result.expiresAt ? formatDateVN(result.expiresAt) : "VĨNH VIỄN";
          desc.innerHTML = `
              <div style="background: rgba(0,255,136,0.05); border: 1px solid rgba(0,255,136,0.2); padding: 15px; border-radius: 8px; margin-top: 10px;">
                  <span style="font-size: 11px; color: #8ba1b5; text-transform: uppercase; font-weight: bold;">HẠN SỬ DỤNG</span><br>
                  <div style="font-size: 14px; color: #00ff88; font-weight: 800; letter-spacing: 1px; margin-top: 5px; text-shadow: 0 0 10px rgba(0,255,136,0.3);">${expText}</div>
              </div>
          `;
          
          btnGroup.innerHTML = ``;
          
          setTimeout(() => {
              if(qs("#auth-modal-overlay").style.display !== "none") {
                  qs("#auth-modal-overlay").style.display = "none";
                  completionCallback(result);
              }
          }, 100); 
          
      } else {
          icon.innerHTML = `<i class="fas fa-ban" style="color:#ff3333;"></i>`; icon.style.borderColor = "#550011";
          badge.innerHTML = "● KEY KHÔNG HỢP LỆ"; badge.style.color = "#a0aab5";
          
          const status = result?.status || "LỖI KẾT NỐI";
          const messageMap = { EXPIRED: "Key Đã Hết Hạn", NOT_FOUND: "Key Không Tồn Tại", HWID_MISMATCH: "Sai Thiết Bị", INVALID_KEY: "Sai Định Dạng", REVOKED: "Key Bị Thu Hồi" };
          
          title.innerText = messageMap[status] || status;
          desc.innerText = "Key nhập vào không tìm thấy trong hệ thống hoặc đã bị lỗi. Kiểm tra lại hoặc lấy key mới từ admin.";
          
          btnGroup.innerHTML = `
              <button class="m-btn btn-doi" id="btn-close-modal"><i class="fas fa-key"></i> ĐỔI KEY</button>
              <button class="m-btn btn-lh" id="btn-contact-modal"><i class="fab fa-facebook-messenger"></i> LIÊN HỆ</button>
          `;
          
          qs("#btn-close-modal").onclick = () => { 
              qs("#auth-modal-overlay").style.display = "none"; 
              completionCallback(result);
              qs("#vgKey").focus(); 
          };
          qs("#btn-contact-modal").onclick = () => { window.open(CONFIG.contactUrl, "_blank"); };
      }
  }

  function normalizeResponse(data) {
    const status = String(data?.status || data?.code || data?.state || "").toUpperCase();
    const valid = data?.valid === true || data?.ok === true || data?.success === true || status === "OK" || status === "VALID" || status === "SUCCESS" || status === "ACTIVATED";
    return { ok: valid, status, expiresAt: data?.expiresAt || data?.expire || data?.expired_at || data?.expiry || "", raw: data };
  }

  async function apiGet(url, params) {
    const u = new URL(url, window.location.origin);
    Object.entries(params).forEach(([k, v]) => { if (v != null) u.searchParams.set(k, v); });
    const res = await fetch(u.toString(), { method: "GET", headers: { Accept: "application/json, text/plain, */*" } });
    const rawText = await res.text(); let data = {};
    try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = { status: "INVALID_JSON", body: rawText, contentType: res.headers.get("content-type"), httpStatus: res.status }; }
    if (!res.ok) { return { ok: false, status: String(data?.status || `HTTP_${res.status}`).toUpperCase(), raw: { httpStatus: res.status, contentType: res.headers.get("content-type"), body: rawText, data } }; }
    return normalizeResponse(data);
  }

  async function checkLicense(key, deviceId) { return apiGet(CONFIG.checkUrl, { key, hwid: deviceId, deviceId }); }
  async function activateLicense(key, deviceId) {
    const res = await fetch(CONFIG.activateUrl, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/plain, */*" }, body: JSON.stringify({ key, hwid: deviceId, deviceId }) });
    const rawText = await res.text(); let data = {};
    try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = { status: "INVALID_JSON", body: rawText, httpStatus: res.status }; }
    if (!res.ok) { return { ok: false, status: String(data?.status || `HTTP_${res.status}`).toUpperCase(), raw: data }; }
    return normalizeResponse(data);
  }

  function renderGate() {
    if (state.mounted) return;
    state.mounted = true;
    
    const style = ce("style");
    style.textContent = `
        /* THEME ĐỎ GỐC SUPER V6.0 - FORM ELITE TURBO */
        #vgGate {
            position:fixed; inset:0; z-index:2147483647;
            display:flex; align-items:flex-start; justify-content:center;
            background:#050002;
            font-family: 'Plus Jakarta Sans', sans-serif; min-height: 100vh;
            overflow-y: auto; padding: 40px 15px;
        }

        #vgGate::before {
            content: ''; position: fixed; inset: 0;
            background: radial-gradient(circle at 50% 10%, rgba(255,0,51,0.15) 0%, transparent 60%),
                        radial-gradient(circle at 20% 80%, rgba(255,0,51,0.05) 0%, transparent 40%);
            pointer-events: none; z-index: 0;
        }

        .cyber-door-wrap { position:absolute; inset:0; z-index:99; display:flex; pointer-events:none; overflow: hidden; display: none; }
        .c-door-left, .c-door-right { width:50%; height:100%; background:rgba(5,0,2,0.98); backdrop-filter: blur(20px); transition:transform 1.2s cubic-bezier(0.77, 0, 0.175, 1); position:relative; overflow: hidden; }
        .c-door-left { border-right:2px solid #ff0033; box-shadow: 10px 0 30px rgba(255,0,51, 0.2); transform:translateX(-100%); }
        .c-door-right { border-left:2px solid #ff0033; box-shadow:-10px 0 30px rgba(255,0,51, 0.2); transform:translateX(100%); }
        .door-icon-left, .door-icon-right { position: absolute; top: 50%; transform: translateY(-50%); font-size: 80px; z-index: 10; color: rgba(255,0,51, 0.6); filter: drop-shadow(0 0 15px rgba(255,0,51, 0.5)); }
        .door-icon-left { right: 40px; } .door-icon-right { left: 40px; }
        .cyber-door-wrap.is-closed .c-door-left, .cyber-door-wrap.is-closed .c-door-right { transform:translateX(0); pointer-events:all; }

        .vg-container {
            width: min(420px, 100%);
            display: flex; flex-direction: column; align-items: center;
            position: relative; z-index: 100;
        }

        .vg-avatar {
            width: 85px; height: 85px; border-radius: 50%;
            border: 2px solid #ff0033; box-shadow: 0 0 25px rgba(255,0,51,0.6);
            background: url('img/cc.jpg') center/cover;
            background-color: #1a0005;
            margin-bottom: 15px; position: relative;
        }
        
        .vg-brand {
            font-size: 26px; color: #ff3333; font-weight: 800; letter-spacing: 4px;
            text-transform: uppercase; text-shadow: 0 0 20px rgba(255,0,51, 0.8);
            margin-bottom: 25px;
        }

        .red-box {
            width: 100%;
            background: rgba(15, 0, 5, 0.4); backdrop-filter: blur(10px);
            border: 1px solid rgba(255,0,51, 0.2);
            border-radius: 12px; padding: 25px 20px;
            position: relative; margin-bottom: 25px;
        }

        .corner { position: absolute; width: 22px; height: 22px; border: 3px solid #ff0033; border-radius: 4px; filter: drop-shadow(0 0 8px #ff0033); }
        .c-tl { top: -2px; left: -2px; border-right: none; border-bottom: none; border-top-left-radius: 12px;}
        .c-tr { top: -2px; right: -2px; border-left: none; border-bottom: none; border-top-right-radius: 12px;}
        .c-bl { bottom: -2px; left: -2px; border-right: none; border-top: none; border-bottom-left-radius: 12px;}
        .c-br { bottom: -2px; right: -2px; border-left: none; border-top: none; border-bottom-right-radius: 12px;}

        .divider {
            display: flex; align-items: center; text-align: center; width: 100%; 
            color: #ff3333; font-size: 11px; font-weight: 700; letter-spacing: 2px; 
            text-transform: uppercase; margin-bottom: 20px; opacity: 0.8;
        }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; border: none;}
        .divider::before { margin-right: 15px; background: linear-gradient(90deg, transparent, rgba(255,0,51,0.6)); }
        .divider::after { margin-left: 15px; background: linear-gradient(270deg, transparent, rgba(255,0,51,0.6)); }

        .vg-field { display: flex; gap: 8px; margin-bottom: 20px; position: relative; }
        .vg-input-icon { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #ff0033; font-size: 14px; }

        .vg-input {
            flex: 1; background: rgba(10, 0, 2, 0.8);
            border: 1px solid rgba(255,0,51, 0.3); border-radius: 8px; color: #fff;
            padding: 14px 14px 14px 42px; font-size: 13px; outline: none; transition: 0.3s;
            font-family: 'Space Grotesk', monospace; font-weight: bold; letter-spacing: 1px;
        }
        .vg-input:focus { border-color: #ff0033; box-shadow: 0 0 15px rgba(255,0,51, 0.2), inset 0 0 10px rgba(255,0,51, 0.1); }
        .vg-input::placeholder { color: rgba(255,255,255,0.2); font-weight: 500;}

        .vg-icon { padding: 0 15px; background: rgba(255,0,51, 0.05); border: 1px solid rgba(255,0,51, 0.3); border-radius: 8px; color: #ff0033; cursor: pointer; font-weight: 800; font-size: 11px; transition: 0.2s; letter-spacing: 1px;}
        .vg-icon:hover { background: rgba(255,0,51, 0.2); box-shadow: 0 0 15px rgba(255,0,51, 0.4); }

        .vg-actions { display: flex; flex-direction: column; gap: 12px; margin-top: 5px; }

        .vg-btn--pri {
            width: 100%; padding: 15px; border-radius: 50px;
            background: transparent; color: #ff0033;
            border: 1px solid #ff0033; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;
            font-size: 14px; cursor: pointer; transition: 0.3s; display: flex; align-items: center; justify-content: center; gap: 10px;
            box-shadow: inset 0 0 15px rgba(255,0,51, 0.1);
        }
        .vg-btn--pri:hover { background: rgba(255,0,51, 0.15); box-shadow: 0 0 20px rgba(255,0,51, 0.4), inset 0 0 15px rgba(255,0,51, 0.2); color:#fff; border-color:#ff3366;}

        /* STYLE: TÍNH NĂNG NỔI BẬT */
        .feature-item {
            background: rgba(15, 0, 5, 0.6); border: 1px solid rgba(255,0,51, 0.2);
            border-radius: 12px; padding: 15px; margin-bottom: 12px;
            display: flex; align-items: flex-start; gap: 15px; transition: 0.3s; width: 100%;
        }
        .feature-item:hover { border-color: rgba(255,0,51, 0.5); box-shadow: 0 0 15px rgba(255,0,51,0.2); }
        .f-icon { 
            width: 32px; height: 32px; border-radius: 50%; border: 1px solid #00ff88; 
            display: flex; align-items: center; justify-content: center; color: #00ff88; flex-shrink: 0;
            box-shadow: inset 0 0 10px rgba(0,255,136,0.1);
        }
        .f-content h4 { margin: 0 0 5px 0; color: #ff3366; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
        .f-content p { margin: 0; color: #8ba1b5; font-size: 12px; line-height: 1.5; font-weight: 500;}

        /* STYLE: AUTH MODAL */
        #auth-modal-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
            z-index: 2000; display: none; align-items: center; justify-content: center;
        }
        .auth-modal {
            width: min(380px, 90%); background: #080002;
            border: 1px solid rgba(255,0,51,0.4); border-radius: 16px;
            box-shadow: 0 0 50px rgba(255,0,51,0.2); padding: 30px 25px;
            position: relative; overflow: hidden;
        }
        .auth-modal::before { content: ''; position: absolute; inset: 0; border: 1px solid #ff0033; border-radius: 16px; opacity: 0.2; pointer-events: none; }
        .corner-m { position: absolute; width: 15px; height: 15px; border: 2px solid #ff0033; filter: drop-shadow(0 0 5px #ff0033); }
        .cm-tl { top: 10px; left: 10px; border-right: none; border-bottom: none; }
        .cm-tr { top: 10px; right: 10px; border-left: none; border-bottom: none; }
        .cm-bl { bottom: 10px; left: 10px; border-right: none; border-top: none; }
        .cm-br { bottom: 10px; right: 10px; border-left: none; border-top: none; }

        .modal-header { text-align: center; color: #ff3366; font-weight: 800; font-size: 14px; margin-bottom: 25px; letter-spacing: 2px; text-transform: uppercase;}
        .shield-icon { 
            width: 70px; height: 70px; margin: 0 auto 25px auto; border-radius: 50%;
            border: 4px solid transparent; border-top-color: #ff0033; border-right-color: #ff0033;
            display: flex; align-items: center; justify-content: center;
            animation: spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
        }
        .shield-icon i { font-size: 24px; color: #ff3366; animation: reverseSpin 1s linear infinite; filter: drop-shadow(0 0 10px #ff0033); }
        
        .auth-step {
            display: flex; align-items: center; gap: 15px; padding: 12px 15px;
            border-radius: 10px; margin-bottom: 12px; background: rgba(10,0,2,0.8);
            border: 1px solid rgba(255,255,255,0.05); transition: 0.3s;
        }
        .auth-step.active { border-color: rgba(255,0,51,0.5); background: rgba(255,0,51,0.1); box-shadow: inset 0 0 10px rgba(255,0,51,0.1); }
        .auth-step.success { border-color: rgba(0,255,136,0.4); background: rgba(0,255,136,0.05); }
        
        .step-icon { width: 26px; height: 26px; border-radius: 50%; background: #1a0005; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #ff3366; }
        .auth-step.success .step-icon { background: #003311; color: #00ff88; }
        .auth-step.active .step-icon { animation: pulse 1s infinite; }
        
        .step-text h5 { margin: 0 0 3px 0; color: #fff; font-size: 13px; font-weight: 700; }
        .step-text p { margin: 0; color: #7a8b9c; font-size: 11px; }

        #auth-result { display: none; text-align: center; }
        .error-circle { width: 70px; height: 70px; border-radius: 50%; border: 2px solid #555; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #888; margin: 0 auto 15px auto; }
        .err-badge { background: #1a0005; color: #a0aab5; font-size: 10px; font-weight: bold; padding: 5px 15px; border-radius: 20px; border: 1px solid #333; display: inline-block; margin-bottom: 15px; letter-spacing: 1px; }
        .err-title { color: #fff; font-size: 20px; font-weight: 800; margin-bottom: 10px; letter-spacing: 1px;}
        .err-desc { color: #8a9ba8; font-size: 12px; line-height: 1.5; margin-bottom: 15px; }
        .err-key-disp { color: #ff0033; font-family: monospace; font-size: 13px; margin-bottom: 25px; letter-spacing: 1px; font-weight: bold;}
        
        .modal-btns { display: flex; gap: 10px; }
        .m-btn { flex: 1; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.3s; text-transform: uppercase; letter-spacing: 1px; }
        .btn-doi { background: #1a0005; border: 1px solid #ff0033; color: #ff0033; }
        .btn-doi:hover { background: #ff0033; color: #fff; box-shadow: 0 0 15px rgba(255,0,51,0.3); }
        .btn-lh { background: #001a08; border: 1px solid #00ff88; color: #00ff88; }
        .btn-lh:hover { background: #00ff88; color: #000; box-shadow: 0 0 15px rgba(0,255,136,0.3); }

        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes reverseSpin { 100% { transform: rotate(-360deg); } }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255,0,51,0.4); } 70% { box-shadow: 0 0 0 10px rgba(255,0,51,0); } 100% { box-shadow: 0 0 0 0 rgba(255,0,51,0); } }
    `;
    document.head.appendChild(style);

    const wrap = ce("div", { id: "vgGate" }, `
      <div class="vg-container">
        
        <div class="vg-avatar"></div>
        <div class="vg-brand">ELITE TURBO</div>

        <div class="red-box">
            <div class="corner c-tl"></div><div class="corner c-tr"></div><div class="corner c-bl"></div><div class="corner c-br"></div>

            <div class="vg-field">
                <i class="fas fa-key vg-input-icon"></i>
                <input id="vgKey" class="vg-input" type="text" placeholder="Nhập Key: HVH-XXXX-XXXX" autocomplete="one-time-code" inputmode="latin">
                <button class="vg-icon hover-sound click-sound" id="vgPasteKey">DÁN</button>
            </div>

            <div class="vg-field" style="margin-bottom: 25px;">
                <i class="fas fa-mobile-alt vg-input-icon"></i>
                <input id="vgDev" class="vg-input" type="text" readonly style="color: #6b8299;">
                <button class="vg-icon hover-sound click-sound" id="vgCopyDev"><i class="fas fa-copy"></i></button>
            </div>

            <div class="vg-actions">
                <button class="vg-btn--pri hover-sound click-sound" id="vgActive"><i class="fas fa-fingerprint"></i> ĐĂNG NHẬP</button>
            </div>
        </div>

        <div class="divider">TÍNH NĂNG NỔI BẬT</div>

        <div style="width: 100%; margin-bottom: 25px;">
            <div class="feature-item">
                <div class="f-icon"><i class="fas fa-check"></i></div>
                <div class="f-content">
                    <h4>AIMLOCK 6.0</h4>
                    <p>Đã Được Update Lên Phiên Bản Mới Nhất</p>
                </div>
            </div>
            <div class="feature-item">
                <div class="f-icon"><i class="fas fa-check"></i></div>
                <div class="f-content">
                    <h4>KEY FREE</h4>
                    <p>Update Key Hàng Ngày Chỉ cần vượt link và lấy key miễn phí</p>
                </div>
            </div>
            <div class="feature-item">
                <div class="f-icon"><i class="fas fa-check"></i></div>
                <div class="f-content">
                    <h4>Câu Hỏi? Thường Gặp!</h4>
                    <p>Không Biết Vượt LINK ? . Tôi Nhắc Bạn Hãy Lên Youtube Tìm Kiếm Cách Vượt Link4m</p>
                </div>
            </div>
            <div class="feature-item">
                <div class="f-icon"><i class="fas fa-check"></i></div>
                <div class="f-content">
                    <h4>Liên Hệ Với Tôi</h4>
                    <p>Bằng Cách Nhấn Trực Tiếp Qua Số Zalo : 0792822868</p>
                </div>
            </div>
        </div>

        <div class="red-box free-key-box" style="margin-bottom: 0;">
            <div class="corner c-tl"></div><div class="corner c-tr"></div><div class="corner c-bl"></div><div class="corner c-br"></div>
            
            <div style="color: #ff0033; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-gift"></i> LIÊN HỆ / MUA KEY TẠI ĐÂY
            </div>

            <div class="vg-field" style="margin-bottom: 15px;">
                <input class="vg-input" type="text" readonly value="${CONFIG.contactUrl}" style="color: #ff3366; font-size: 12px;">
                <button class="vg-icon hover-sound click-sound" id="vgCopyLink"><i class="fas fa-copy"></i></button>
            </div>

            <button class="vg-btn--pri hover-sound click-sound" id="vgContact" style="font-size: 12px; padding: 12px;"><i class="fas fa-external-link-square-alt"></i> LIÊN HỆ NGAY</button>
        </div>

      </div>

      <div id="auth-modal-overlay">
          <div class="auth-modal">
              <div class="corner-m cm-tl"></div><div class="corner-m cm-tr"></div><div class="corner-m cm-bl"></div><div class="corner-m cm-br"></div>
              
              <div id="auth-progress">
                  <div class="modal-header"><i class="fas fa-cloud-download-alt"></i> XÁC THỰC LICENSE</div>
                  <div class="shield-icon"><i class="fas fa-shield-alt"></i></div>
                  
                  <div class="auth-step" id="step-1">
                      <div class="step-icon"><i class="fas fa-check"></i></div>
                      <div class="step-text"><h5>Kết nối máy chủ</h5><p>Đang kết nối server xác thực...</p></div>
                  </div>
                  <div class="auth-step" id="step-2">
                      <div class="step-icon"><i class="fas fa-spinner"></i></div>
                      <div class="step-text"><h5>Kiểm tra License Key</h5><p>Xác minh tính hợp lệ...</p></div>
                  </div>
                  <div class="auth-step" id="step-3">
                      <div class="step-icon"><i class="fas fa-circle"></i></div>
                      <div class="step-text"><h5>Mở khóa chức năng</h5><p>Kích hoạt các module...</p></div>
                  </div>
              </div>

              <div id="auth-result">
                  <div class="error-circle" id="res-icon"></div>
                  <div class="err-badge" id="res-badge"></div>
                  <div class="err-title" id="res-title"></div>
                  <div class="err-desc" id="res-desc"></div>
                  <div class="err-key-disp" id="res-key-text"></div>
                  <div class="modal-btns" id="res-btn-group"></div>
              </div>
          </div>
      </div>
    `);
    document.body.appendChild(wrap);

    qs("#vgKey").value = loadSavedKey();
    qs("#vgDev").value = state.deviceId;

    qs("#vgPasteKey").onclick = async () => { try { const text = await navigator.clipboard.readText(); qs("#vgKey").value = (text || "").trim(); toast("ĐÃ DÁN MÃ VÀO KHUNG.", "ok"); } catch { qs("#vgKey").value = (prompt("VUI LÒNG NHẬP MÃ THỦ CÔNG:", "") || "").trim(); } qs("#vgKey").focus(); };
    qs("#vgCopyDev").onclick = async () => { try { await navigator.clipboard.writeText(state.deviceId); toast("ĐÃ SAO CHÉP MÃ THIẾT BỊ.", "ok"); } catch { toast("SAO CHÉP THẤT BẠI. VUI LÒNG CHỌN VÀ COPY.", "warn"); } };
    qs("#vgCopyLink").onclick = async () => { try { await navigator.clipboard.writeText(CONFIG.contactUrl); toast("ĐÃ COPY LINK!", "ok"); } catch { toast("LỖI COPY", "err"); } };
    qs("#vgContact").onclick = () => { window.open(CONFIG.contactUrl, "_blank"); };
    
    qs("#vgActive").onclick = onActivate;

    initStarEffect();
  }

  function initStarEffect() {
      if (qs('#star-canvas')) return;

      const gate = qs('#vgGate');
      const canvas = ce('canvas', { id: 'star-canvas' });
      canvas.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; pointer-events:none; z-index: 1;";
      gate.insertBefore(canvas, gate.firstChild); 

      const ctx = canvas.getContext('2d');
      let w, h;
      function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
      window.addEventListener('resize', resize); resize();

      let stars = []; let particles = [];

      function spawnStar() {
          if (Math.random() > 0.08) return; 
          stars.push({ x: Math.random() * w + w * 0.5, y: -50, vx: -(Math.random() * 4 + 3), vy: (Math.random() * 4 + 3), len: Math.random() * 40 + 20, color: 'rgba(255, 0, 51, 0.8)' });
      }

      function spawnParticles(x, y) {
          for(let i=0; i<12; i++) { particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 1, decay: Math.random() * 0.03 + 0.02, color: Math.random() > 0.5 ? '#ff0033' : '#ff6680' }); }
      }

      function loop() {
          if (gate.style.display === 'none') { requestAnimationFrame(loop); return; }
          ctx.clearRect(0, 0, w, h);
          const boxes = Array.from(document.querySelectorAll('#vgGate .red-box')).map(b => b.getBoundingClientRect());

          for(let i = stars.length - 1; i >= 0; i--) {
              let s = stars[i]; s.x += s.vx; s.y += s.vy;
              const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * (s.len/5), s.y - s.vy * (s.len/5));
              grad.addColorStop(0, '#fff'); grad.addColorStop(0.2, '#ff0033'); grad.addColorStop(1, 'transparent'); 
              ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * (s.len/5), s.y - s.vy * (s.len/5));
              ctx.strokeStyle = grad; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.stroke();
              
              let hit = false;
              for(let r of boxes) { if (s.x > r.left && s.x < r.right && s.y > r.top && s.y < r.bottom) { hit = true; break; } }
              if (hit) { spawnParticles(s.x, s.y); stars.splice(i, 1); } 
              else if (s.x < -100 || s.y > h + 100) { stars.splice(i, 1); }
          }

          for(let i = particles.length - 1; i >= 0; i--) {
              let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= p.decay;
              if (p.life <= 0) { particles.splice(i, 1); continue; }
              ctx.beginPath(); ctx.arc(p.x, p.y, Math.random() * 2 + 1, 0, Math.PI*2);
              ctx.fillStyle = `rgba(255, 51, 102, ${p.life})`; ctx.shadowBlur = 10; ctx.shadowColor = '#ff0033'; ctx.fill(); ctx.shadowBlur = 0; 
          }
          spawnStar(); requestAnimationFrame(loop);
      }
      loop();
  }

  async function safeCall(fn) {
    try { return await fn(); } catch (err) { console.error(err); return { ok: false, status: "LỖI MẠNG", raw: String(err) }; }
  }

  async function onActivate() {
    const key = qs("#vgKey").value.trim();
    if (!key) return toast("VUI LÒNG NHẬP MÃ KÍCH HOẠT.", "warn");

    startModalAuth(
        async () => { return await safeCall(() => activateLicense(key, state.deviceId)); }, 
        (result) => { handleLicenseResult(result, key, "activate"); },
        key
    );
  }

  function handleLicenseResult(result, key, mode) {
    const status = result.status || "";
    const expiresAt = result.expiresAt || "";

    if (result.ok) {
      saveKey(key); state.verified = true; state.expiresAt = expiresAt;
      if (mode === "activate") {
          unlockUI(false); 
      } else if (mode === "boot") {
          unlockUI(true);
      }
      dispatchLicenseChange({ state: mode, verified: true, key, deviceId: state.deviceId, expiresAt, raw: result.raw });
      return;
    }

    state.verified = false;
    const messageMap = { EXPIRED: "LỖI: MÃ ĐÃ HẾT HẠN ⛔", REVOKED: "LỖI: MÃ BỊ THU HỒI 🚫", NOT_FOUND: "LỖI: KHÔNG TÌM THẤY MÃ ⚠️", INVALID_KEY: "LỖI: SAI ĐỊNH DẠNG ❌", HWID_MISMATCH: "LỖI: THIẾT BỊ KHÔNG KHỚP 📱", BOUND_TO_ANOTHER_DEVICE: "LỖI: MÃ ĐÃ ĐƯỢC GẮN VỚI THIẾT BỊ KHÁC.", INVALID_JSON: "LỖI: DỮ LIỆU PHẢN HỒI LỖI." };
    toast(messageMap[status] || `❌ MÃ LỖI: ${escapeHtml(status || "KHÔNG_XÁC_ĐỊNH")}`, "err", result.raw);
    
    if (CONFIG.relockWhenInvalid) lockUI();
    dispatchLicenseChange({ state: "invalid", verified: false, key, deviceId: state.deviceId, expiresAt: "", raw: result.raw });
  }

  async function autoBootCheck() {
    const savedKey = loadSavedKey();
    if (!savedKey || !CONFIG.autoCheckOnLoad) { lockUI(); return; }
    const result = await safeCall(() => checkLicense(savedKey, state.deviceId));
    if (!result) { lockUI(); return; }
    handleLicenseResult(result, savedKey, "boot");
  }

  function init() {
    state.deviceId = getOrCreateDeviceId(); renderGate(); autoBootCheck();
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible" || !state.verified) return; 
      const savedKey = loadSavedKey();
      if (!savedKey) return;
      const result = await safeCall(() => checkLicense(savedKey, state.deviceId));
      if (result && !result.ok) {
          handleLicenseResult(result, savedKey, "check");
      }
    });

    window.VSHKeyGate = {
      show: lockUI, hide: unlockUI,
      reset() { clearKey(); state.verified = false; lockUI(); },
      getState() { return { ...state }; },
      async activate() { return onActivate(); },
    };
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init, { once: true }); } 
  else { init(); }
})();