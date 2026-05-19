document.addEventListener('DOMContentLoaded', async () => {
    const { targetLanguage } = await chrome.storage.local.get('targetLanguage');
    const lang = targetLanguage || 'en';
    const t = getT(lang);

    document.documentElement.lang = lang;
    const RTL_LANGS = new Set(['ar', 'ur', 'he', 'fa']);
    document.documentElement.dir = RTL_LANGS.has(lang.split('-')[0]) ? 'rtl' : 'ltr';

    const brandName = document.querySelector('.brand-title .name');
    const brandSub = document.querySelector('.brand-title .sub');
    const hintEl = document.querySelector('.hint');
    const translateLabel = document.querySelector('#translateBtn span');
    const excludeLabel = document.querySelector('#excludeBtn span');
    const optionsLabel = document.querySelector('#optionsBtn span');

    if (brandName) brandName.textContent = t.popupName;
    if (brandSub) brandSub.textContent = t.popupSub;
    if (hintEl) hintEl.textContent = t.popupHint;
    if (translateLabel) translateLabel.textContent = t.translateBtn;
    if (excludeLabel) excludeLabel.textContent = t.excludeBtn;
    if (optionsLabel) optionsLabel.textContent = t.optionsBtn;

    const translateBtn = document.getElementById('translateBtn');
    const excludeBtn = document.getElementById('excludeBtn');
    const optionsBtn = document.getElementById('optionsBtn');

    translateBtn?.addEventListener('click', async () => {
        setStatus(t.connecting, 'info');
        translateBtn.disabled = true;
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                setStatus(t.noResponse, 'error');
                translateBtn.disabled = false;
                return;
            }
            if (tab.url) {
                try {
                    const url = new URL(tab.url);
                    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                        setStatus(t.cannotExclude, 'error');
                        translateBtn.disabled = false;
                        return;
                    }
                } catch (e) {
                    setStatus(t.invalidUrl, 'error');
                    translateBtn.disabled = false;
                    return;
                }
            }
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'startTranslationFromPopup' });
            if (response) {
                if (response.status === 'alreadyTranslating') {
                    setStatus(t.translationInProgress, 'info');
                    translateBtn.disabled = false;
                } else if (response.status === 'starting') {
                    setStatus(t.startMessage, 'success');
                    setTimeout(() => window.close(), 900);
                } else if (response.status === 'warningShown') {
                    setStatus(t.warningShown, 'info');
                    setTimeout(() => window.close(), 1400);
                } else if (response.status === 'cancelled') {
                    setStatus(t.translationCancelled, 'info');
                    translateBtn.disabled = false;
                } else if (response.status === 'no_text') {
                    setStatus(t.noTextFound, 'info');
                    translateBtn.disabled = false;
                } else {
                    setStatus(t.noResponse, 'error');
                    translateBtn.disabled = false;
                }
            } else {
                setStatus(t.noResponse, 'error');
                translateBtn.disabled = false;
            }
        } catch (error) {
            setStatus(t.connectionError, 'error');
            translateBtn.disabled = false;
        }
    });

    excludeBtn?.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) { setStatus(t.cannotExclude, 'error'); return; }
            let origin;
            try {
                const url = new URL(tab.url);
                if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                    setStatus(t.cannotExclude, 'error'); return;
                }
                origin = url.origin;
            } catch (e) { setStatus(t.invalidUrl, 'error'); return; }
            const { excludeList } = await chrome.storage.local.get('excludeList');
            let sites;
            if (Array.isArray(excludeList)) {
                sites = excludeList.map(s => String(s).trim()).filter(Boolean);
            } else if (typeof excludeList === 'string') {
                sites = excludeList.split('\n').map(s => s.trim()).filter(Boolean);
            } else {
                sites = [];
            }
            if (sites.includes(origin)) { setStatus(t.alreadyExcluded, 'info'); return; }
            sites.push(origin);
            await chrome.storage.local.set({ excludeList: sites });
            setStatus(t.setExcluded, 'success');
        } catch (error) {
            setStatus(t.translationError, 'error');
        }
    });

    optionsBtn?.addEventListener('click', () => { chrome.runtime.openOptionsPage(); });
});

function setStatus(message, kind = 'info') {
    const el = document.getElementById('statusText');
    if (!el) return;
    el.textContent = message || '';
    el.classList.remove('info', 'error', 'success');
    if (message) el.classList.add(kind);
}
