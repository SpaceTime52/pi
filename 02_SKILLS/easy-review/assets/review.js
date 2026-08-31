(() => {
  const expandButton = document.querySelector('[data-action="expand-all"]');
  if (expandButton) {
    expandButton.addEventListener('click', () => {
      const details = Array.from(document.querySelectorAll('details.review-section, details.inline-fold, details.supporting-files'));
      const shouldOpen = details.some((item) => !item.open);
      details.forEach((item) => { item.open = shouldOpen; });
      expandButton.textContent = shouldOpen ? '전체 접기' : '전체 펼치기';
    });
  }

  const anchorButton = document.querySelector('[data-action="toggle-anchors"]');
  if (anchorButton) {
    anchorButton.addEventListener('click', () => {
      document.body.classList.toggle('show-anchor-ids');
      anchorButton.textContent = document.body.classList.contains('show-anchor-ids')
        ? '근거 ID 숨기기'
        : '근거 ID 보기';
    });
  }

  const revealLinkedContent = () => {
    if (!window.location.hash) return;
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    if (!target) return;
    if (target.matches('details')) target.open = true;
    let parent = target.closest('details');
    while (parent) {
      parent.open = true;
      parent = parent.parentElement?.closest('details');
    }
  };
  window.addEventListener('hashchange', revealLinkedContent);
  revealLinkedContent();

  if (window.Prism) {
    window.Prism.highlightAllUnder(document.querySelector('.shell'));
  }

  const minimap = document.querySelector('.minimap');
  const minimapToggle = document.querySelector('[data-action="toggle-minimap"]');
  const minimapLinks = Array.from(document.querySelectorAll('[data-minimap-link]'));
  const reviewSections = Array.from(document.querySelectorAll('[data-review-section]'));

  if (minimap && minimapToggle) {
    minimapToggle.addEventListener('click', () => {
      const isOpen = minimap.classList.toggle('is-open');
      minimapToggle.setAttribute('aria-expanded', String(isOpen));
    });
    minimapLinks.forEach((link) => {
      link.addEventListener('click', () => {
        minimap.classList.remove('is-open');
        minimapToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  if (minimapLinks.length && reviewSections.length) {
    const updateMinimap = () => {
      const documentHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const progress = Math.min(100, Math.max(0, Math.round((window.scrollY / documentHeight) * 100)));
      document.querySelectorAll('[data-minimap-progress]').forEach((item) => {
        item.style.width = `${progress}%`;
      });
      document.querySelectorAll('[data-minimap-percent]').forEach((item) => {
        item.textContent = `${progress}% 읽음`;
      });

      const readingLine = window.scrollY + Math.min(window.innerHeight * 0.32, 280);
      let activeIndex = 0;
      reviewSections.forEach((section, sectionIndex) => {
        if (section.offsetTop <= readingLine) activeIndex = sectionIndex;
      });
      minimapLinks.forEach((link, linkIndex) => {
        link.classList.toggle('active', linkIndex === activeIndex);
        link.classList.toggle('visited', linkIndex < activeIndex);
      });
      const activeLink = minimapLinks[activeIndex];
      const currentLabel = `${String(activeIndex + 1).padStart(2, '0')}/${String(minimapLinks.length).padStart(2, '0')} · ${activeLink.dataset.sectionTitle}`;
      document.querySelectorAll('[data-minimap-current]').forEach((item) => {
        item.textContent = currentLabel;
      });
    };

    let minimapUpdateRequested = false;
    const requestMinimapUpdate = () => {
      if (minimapUpdateRequested) return;
      minimapUpdateRequested = true;
      window.requestAnimationFrame(() => {
        updateMinimap();
        minimapUpdateRequested = false;
      });
    };
    window.addEventListener('scroll', requestMinimapUpdate, { passive: true });
    window.addEventListener('resize', requestMinimapUpdate);
    document.querySelectorAll('details').forEach((item) => item.addEventListener('toggle', requestMinimapUpdate));
    updateMinimap();
  }
})();

(() => {
  const dock = document.querySelector('[data-chat-dock]');
  if (!dock) return;
  const toggle = dock.querySelector('[data-action="toggle-chat"]');
  const panel = dock.querySelector('.chat-panel');
  const statusLabel = dock.querySelector('[data-chat-status]');
  const branchLabel = dock.querySelector('[data-chat-branch]');
  const modelSelect = dock.querySelector('[data-chat-model-select]');
  const offlineNotice = dock.querySelector('[data-chat-offline]');
  const chatBody = dock.querySelector('[data-chat-body]');
  const newChatButton = dock.querySelector('[data-action="new-chat"]');
  const closeButton = dock.querySelector('[data-action="close-chat"]');

  let chat = null;
  let history = [];
  const newSessionId = () => 's' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  let session = newSessionId();

  const setStatus = (state, text) => {
    statusLabel.textContent = text;
    statusLabel.dataset.state = state;
  };

  const openPanel = (open) => {
    panel.hidden = !open;
    dock.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open && chat) chat.focusInput();
  };
  toggle.addEventListener('click', () => openPanel(panel.hidden));
  if (closeButton) closeButton.addEventListener('click', () => openPanel(false));
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && !panel.hidden) openPanel(false);
    },
    true,
  );
  newChatButton.addEventListener('click', () => {
    history = [];
    session = newSessionId();
    if (chat) {
      chat.clearMessages();
      chat.focusInput();
    }
  });

  const cssVar = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();

  const readFileAttachment = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    const name = file.name || 'file';
    reader.onerror = () => resolve(null);
    if ((file.type || '').startsWith('image/')) {
      reader.onload = () => resolve({ kind: 'image', name, data: String(reader.result) });
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf' || /\.pdf$/i.test(name)) {
      reader.onload = () => resolve({ kind: 'pdf', name, data: String(reader.result) });
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        const text = String(reader.result);
        if (text.includes('\u0000')) {
          resolve(null);
          return;
        }
        resolve({ kind: 'text', name, text: text.slice(0, 100000) });
      };
      reader.readAsText(file);
    }
  });

  const parseRequest = async (body) => {
    let text = '';
    const attachments = [];
    if (body instanceof FormData) {
      for (const [key, value] of body.entries()) {
        if (key === 'files' && value instanceof File) {
          const attachment = await readFileAttachment(value);
          if (attachment) attachments.push(attachment);
        } else if (key.startsWith('message')) {
          try {
            const message = JSON.parse(String(value));
            if (message.role === 'user' && message.text) text = message.text;
          } catch { /* not JSON */ }
        }
      }
    } else if (body && Array.isArray(body.messages)) {
      const last = body.messages[body.messages.length - 1];
      if (last && last.text) text = last.text;
    }
    return { text, attachments };
  };

  const toolDescription = (event) => {
    const args = event.args || {};
    if (event.name === 'read_diff') return '변경 코드 확인 · ' + (args.path || '변경 파일 목록');
    if (event.name === 'read_file') return '파일 읽음 · ' + (args.path || '');
    if (event.name === 'list_dir') return '폴더 확인 · ' + (args.path || '저장소 루트');
    if (event.name === 'search_code') return '코드 검색 · ' + (args.query || '');
    return '도구 실행 · ' + event.name;
  };

  const handler = async (body, signals) => {
    const { text, attachments } = await parseRequest(body);
    if (!text.trim() && !attachments.length) {
      signals.onResponse({ error: '메시지를 입력해 주세요.' });
      return;
    }
    if (attachments.length > 4) {
      signals.onResponse({ error: '첨부는 메시지당 최대 4개까지예요.' });
      return;
    }
    const message = { role: 'user', content: text };
    if (attachments.length) message.attachments = attachments;
    history.push(message);
    let answered = false;
    let responded = false;
    try {
      const response = await fetch('api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, messages: history, model: modelSelect.value || undefined }),
      });
      if (!response.ok || !response.body) throw new Error('HTTP ' + response.status);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const raw = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);
          if (!raw.startsWith('data: ')) continue;
          const event = JSON.parse(raw.slice(6));
          if (event.type === 'tool') {
            chat.addMessage({ role: 'activity', text: toolDescription(event) }, false);
          } else if (event.type === 'answer') {
            answered = true;
            responded = true;
            history.push({ role: 'assistant', content: event.text });
            signals.onResponse({ text: event.text });
          } else if (event.type === 'error') {
            responded = true;
            signals.onResponse({ error: event.text });
          }
        }
      }
      if (!responded) signals.onResponse({ error: '서버 응답이 비어 있습니다.' });
    } catch (error) {
      signals.onResponse({ error: '요청에 실패했습니다: ' + error.message });
    }
    if (!answered) history.pop();
  };

  const mountChat = () => {
    const accent = cssVar('--chat-accent') || '#6c2bd9';
    const accentDeep = cssVar('--chat-accent-deep') || '#5b21c4';
    const aiAvatar = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
      + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="' + accent + '"/><stop offset="1" stop-color="' + accentDeep + '"/>'
      + '</linearGradient></defs><circle cx="16" cy="16" r="16" fill="url(#g)"/>'
      + '<text x="16" y="20.5" font-family="-apple-system,sans-serif" font-size="11.5" font-weight="700" fill="#fff" text-anchor="middle">AI</text></svg>',
    );
    chat = document.createElement('deep-chat');
    chat.connect = { handler };
    chat.requestBodyLimits = { maxMessages: 1 };
    chat.dragAndDrop = true;
    chat.images = { files: { maxNumberOfFiles: 4 } };
    chat.mixedFiles = { files: { maxNumberOfFiles: 4 } };
    chat.introMessage = { text: '안녕하세요! 이 변경이나 코드베이스에 대해 무엇이든 물어보세요. 이미지·PDF·텍스트 파일도 첨부할 수 있어요.' };
    chat.avatars = {
      default: { styles: { position: 'start', avatar: { width: '26px', height: '26px', marginTop: '6px' } } },
      ai: { src: aiAvatar },
      user: { styles: { avatar: { display: 'none' }, container: { display: 'none' } } },
      activity: { styles: { avatar: { display: 'none' }, container: { display: 'none' } } },
      error: { styles: { avatar: { display: 'none' }, container: { display: 'none' } } },
    };
    chat.textInput = {
      placeholder: { text: '메시지를 입력하세요', style: { color: cssVar('--ink-tertiary') } },
      styles: {
        container: {
          backgroundColor: cssVar('--code'),
          border: 'none',
          borderRadius: '22px',
          color: cssVar('--ink'),
          boxShadow: 'none',
          padding: '3px 14px',
          fontSize: '13.5px',
        },
      },
    };
    chat.inputAreaStyle = { backgroundColor: 'transparent', paddingBottom: '8px' };
    chat.submitButtonStyles = {
      submit: {
        container: {
          default: {
            backgroundColor: accent,
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            marginRight: '8px',
            bottom: '13px',
          },
          hover: { backgroundColor: accentDeep },
        },
        svg: { styles: { default: { filter: 'brightness(0) invert(1)', width: '15px' } } },
      },
      disabled: {
        container: {
          default: {
            backgroundColor: cssVar('--code'),
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            marginRight: '8px',
            bottom: '13px',
          },
        },
        svg: { styles: { default: { filter: 'grayscale(1) opacity(0.45)', width: '15px' } } },
      },
    };
    chat.attachmentContainerStyle = { backgroundColor: 'transparent', borderTop: '1px solid ' + cssVar('--rule') };
    chat.chatStyle = {
      width: '100%',
      height: '100%',
      border: 'none',
      backgroundColor: 'transparent',
      fontFamily: getComputedStyle(document.body).fontFamily,
    };
    chat.auxiliaryStyle = '::-webkit-scrollbar {width: 5px;} ::-webkit-scrollbar-thumb {background: rgba(130,130,150,.35); border-radius: 3px;}';
    chat.messageStyles = {
      default: {
        shared: {
          bubble: { fontSize: '13.5px', padding: '10px 14px', maxWidth: '82%', lineHeight: '1.55' },
        },
        user: {
          bubble: { backgroundColor: accent, color: '#ffffff', borderRadius: '18px 18px 6px 18px' },
        },
        ai: {
          bubble: {
            backgroundColor: cssVar('--code'),
            color: cssVar('--ink'),
            borderRadius: '18px 18px 18px 6px',
          },
        },
        activity: {
          bubble: {
            backgroundColor: 'transparent',
            color: cssVar('--ink-tertiary'),
            fontSize: '11px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            padding: '0px 4px',
            marginTop: '0px',
            marginBottom: '0px',
          },
        },
      },
      error: {
        bubble: {
          backgroundColor: 'transparent',
          border: '1px solid ' + cssVar('--danger'),
          color: cssVar('--danger'),
          fontSize: '12.5px',
          borderRadius: '14px',
        },
      },
      intro: {
        bubble: { backgroundColor: cssVar('--accent-wash'), color: cssVar('--ink'), borderRadius: '18px 18px 18px 6px' },
      },
    };
    chatBody.appendChild(chat);
  };

  (async () => {
    try {
      const response = await fetch('api/status', { cache: 'no-store' });
      const data = await response.json();
      if (!data.ok) throw new Error('server not ready');
      offlineNotice.hidden = true;
      branchLabel.textContent = data.branch || '';
      const models = Array.isArray(data.models) && data.models.length ? data.models : [data.model];
      modelSelect.textContent = '';
      models.forEach((id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = id;
        modelSelect.appendChild(option);
      });
      const saved = localStorage.getItem('easyReviewChatModel');
      modelSelect.value = saved && models.includes(saved) ? saved : data.model;
      modelSelect.hidden = false;
      modelSelect.addEventListener('change', () => localStorage.setItem('easyReviewChatModel', modelSelect.value));
      setStatus(data.has_key ? 'online' : 'warn', data.has_key ? '온라인' : 'API 키 없음');
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'vendor/deep-chat.js';
      script.onload = () => {
        mountChat();
        document.querySelectorAll('.ask-ai').forEach((button) => {
          button.hidden = false;
          button.addEventListener('click', () => {
            openPanel(true);
            chat.submitUserMessage({
              text: '`' + button.dataset.askPath + '` 변경이 무엇을 바꾸는지 쉽게 설명해줘. 필요하면 저장소의 관련 코드도 읽고 근거를 알려줘.',
            });
          });
        });
      };
      script.onerror = () => setStatus('warn', '채팅 UI 로드 실패');
      document.body.appendChild(script);
    } catch {
      setStatus('offline', '오프라인');
    }
  })();
})();

(() => {
  const make = (parent, tag, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    parent.appendChild(node);
    return node;
  };
  const SVGNS = 'http://www.w3.org/2000/svg';

  const buildFlow = (container, spec) => {
    const nodes = spec.nodes || [];
    const edges = (spec.edges || []).filter((edge) => edge.from !== edge.to);
    container.classList.add('diagram-flow');
    const layerOf = {};
    const incoming = {};
    nodes.forEach((node) => { incoming[node.id] = []; });
    edges.forEach((edge) => { if (incoming[edge.to]) incoming[edge.to].push(edge.from); });
    const depth = (id, seen) => {
      if (layerOf[id] !== undefined) return layerOf[id];
      if (seen.has(id)) return 0;
      seen.add(id);
      const parents = incoming[id] || [];
      layerOf[id] = parents.length ? Math.max(...parents.map((p) => depth(p, seen))) + 1 : 0;
      return layerOf[id];
    };
    nodes.forEach((node) => depth(node.id, new Set()));
    const layers = [];
    nodes.forEach((node) => {
      const layer = layerOf[node.id] || 0;
      (layers[layer] = layers[layer] || []).push(node);
    });
    const canvas = make(container, 'div', 'flow-canvas');
    const columns = make(canvas, 'div', 'flow-columns');
    const nodeElements = {};
    layers.forEach((group) => {
      const column = make(columns, 'div', 'flow-col');
      group.forEach((node) => {
        const box = make(column, 'div', 'flow-node' + (node.shape ? ' shape-' + node.shape : ''));
        make(box, 'strong').textContent = node.label;
        if (node.note) make(box, 'span').textContent = node.note;
        nodeElements[node.id] = box;
      });
    });
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'flow-wires');
    canvas.appendChild(svg);
    const labelElements = edges.map((edge) => {
      if (!edge.label) return null;
      const label = make(canvas, 'span', 'flow-edge-label');
      label.textContent = edge.label;
      return label;
    });
    const accent = () => getComputedStyle(document.body).getPropertyValue('--ink-tertiary').trim() || '#888';
    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      svg.setAttribute('width', String(canvas.scrollWidth));
      svg.setAttribute('height', String(canvas.scrollHeight));
      svg.textContent = '';
      const defs = document.createElementNS(SVGNS, 'defs');
      const marker = document.createElementNS(SVGNS, 'marker');
      marker.setAttribute('id', 'flow-arrow');
      marker.setAttribute('viewBox', '0 0 8 8');
      marker.setAttribute('refX', '7');
      marker.setAttribute('refY', '4');
      marker.setAttribute('markerWidth', '7');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('orient', 'auto-start-reverse');
      const tip = document.createElementNS(SVGNS, 'path');
      tip.setAttribute('d', 'M0,0.5 L7.5,4 L0,7.5 Z');
      tip.setAttribute('fill', accent());
      marker.appendChild(tip);
      defs.appendChild(marker);
      svg.appendChild(defs);
      edges.forEach((edge, index) => {
        const fromBox = nodeElements[edge.from];
        const toBox = nodeElements[edge.to];
        if (!fromBox || !toBox) return;
        const a = fromBox.getBoundingClientRect();
        const b = toBox.getBoundingClientRect();
        const forward = b.left >= a.right - 4;
        const x1 = (forward ? a.right : a.left) - bounds.left;
        const y1 = a.top + a.height / 2 - bounds.top;
        const x2 = (forward ? b.left : b.right) - bounds.left;
        const y2 = b.top + b.height / 2 - bounds.top;
        const bend = Math.max(24, Math.abs(x2 - x1) / 2) * (forward ? 1 : -1);
        const path = document.createElementNS(SVGNS, 'path');
        path.setAttribute('d', `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', accent());
        path.setAttribute('stroke-width', '1.4');
        path.setAttribute('marker-end', 'url(#flow-arrow)');
        svg.appendChild(path);
        const label = labelElements[index];
        if (label) {
          label.style.left = (x1 + x2) / 2 + 'px';
          label.style.top = (y1 + y2) / 2 + 'px';
        }
      });
    };
    requestAnimationFrame(draw);
    window.addEventListener('resize', () => requestAnimationFrame(draw));
    document.fonts?.ready?.then(() => requestAnimationFrame(draw));
  };

  const buildSequence = (container, spec) => {
    const actors = spec.actors || [];
    const steps = spec.steps || [];
    const count = actors.length;
    if (!count) return;
    container.classList.add('diagram-sequence');
    const head = make(container, 'div', 'seq-actors');
    head.style.gridTemplateColumns = `repeat(${count}, 1fr)`;
    actors.forEach((actor) => { make(head, 'div', 'seq-actor').textContent = actor.label; });
    const body = make(container, 'div', 'seq-body');
    actors.forEach((actor, index) => {
      const lifeline = make(body, 'i', 'seq-lifeline');
      lifeline.style.left = ((index + 0.5) / count) * 100 + '%';
    });
    const positions = {};
    actors.forEach((actor, index) => { positions[actor.id] = index; });
    steps.forEach((step) => {
      const fromIndex = positions[step.from];
      const toIndex = positions[step.to];
      if (fromIndex === undefined || toIndex === undefined) return;
      const row = make(body, 'div', 'seq-row');
      if (fromIndex === toIndex) {
        const selfCall = make(row, 'div', 'seq-self');
        selfCall.style.left = ((fromIndex + 0.5) / count) * 100 + '%';
        selfCall.textContent = step.label;
        if (step.note) selfCall.title = step.note;
        return;
      }
      const left = Math.min(fromIndex, toIndex);
      const span = Math.abs(toIndex - fromIndex);
      const arrow = make(row, 'div', 'seq-arrow ' + (fromIndex < toIndex ? 'dir-right' : 'dir-left'));
      arrow.style.left = ((left + 0.5) / count) * 100 + '%';
      arrow.style.width = (span / count) * 100 + '%';
      const label = make(arrow, 'span', 'seq-step-label');
      label.textContent = step.label;
      if (step.note) label.title = step.note;
    });
  };

  const buildEr = (container, spec) => {
    container.classList.add('diagram-er');
    const grid = make(container, 'div', 'er-grid');
    (spec.entities || []).forEach((entity) => {
      const card = make(grid, 'div', 'er-entity');
      make(card, 'div', 'er-entity-name').textContent = entity.name;
      (entity.fields || []).forEach((field) => {
        const row = make(card, 'div', 'er-field');
        if (field.key) make(row, 'i', 'er-key ' + field.key).textContent = field.key.toUpperCase();
        make(row, 'span', 'er-field-name').textContent = field.name;
        if (field.type) make(row, 'span', 'er-field-type').textContent = field.type;
      });
    });
    const relations = spec.relations || [];
    if (relations.length) {
      const list = make(container, 'div', 'er-relations');
      relations.forEach((relation) => {
        const chip = make(list, 'span', 'er-relation');
        make(chip, 'b').textContent = relation.from;
        make(chip, 'i').textContent = ' —' + (relation.label ? relation.label : '') + '→ ';
        make(chip, 'b').textContent = relation.to;
      });
    }
  };

  document.querySelectorAll('.easy-diagram[data-diagram]').forEach((container) => {
    let spec;
    try { spec = JSON.parse(container.dataset.diagram); } catch { return; }
    if (spec.kind === 'flow') buildFlow(container, spec);
    else if (spec.kind === 'sequence') buildSequence(container, spec);
    else if (spec.kind === 'er') buildEr(container, spec);
  });
})();
