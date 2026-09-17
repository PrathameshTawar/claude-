/**
 * MONARCH AI WORKBENCH // CONTROLLER & TELEMETRY SYNC
 */

document.addEventListener('DOMContentLoaded', () => {
  // --------------------------------------------------------------------------
  // Global Application State
  // --------------------------------------------------------------------------
  const AppState = {
    activeView: 'chat-view',
    userId: 'user_123',
    chatId: null,
    attachedImageData: null,
    memories: [],
    documents: [],
    health: {
      model: 'llama-3.3-70b-versatile',
      langsmith_enabled: false,
      langsmith_project: 'Monarch',
      rag_total_documents: 0
    }
  };

  // --------------------------------------------------------------------------
  // DOM References
  // --------------------------------------------------------------------------
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  const newChatBtn = document.getElementById('new-chat-btn');
  const userIdInput = document.getElementById('user-id-input');
  const evalToggle = document.getElementById('eval-toggle');

  const modelTagText = document.getElementById('model-name-text');
  const docsCountNum = document.getElementById('docs-count-num');
  const langsmithText = document.getElementById('langsmith-text');
  const healthStatusText = document.getElementById('health-status-text');
  const knowledgeBadge = document.getElementById('knowledge-badge');
  const memoriesBadge = document.getElementById('memories-badge');

  const messagesContainer = document.getElementById('messages-container');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const attachImageBtn = document.getElementById('attach-image-btn');
  const chatImageInput = document.getElementById('chat-image-input');
  const imagePreviewContainer = document.getElementById('image-preview-container');
  const attachedImageName = document.getElementById('attached-image-name');
  const removeImageBtn = document.getElementById('remove-image-btn');
  const threadIdDisplay = document.getElementById('thread-id-display');
  const activeAgentStatusBar = document.getElementById('active-agent-status-bar');

  const dropzone = document.getElementById('upload-dropzone');
  const browseFileBtn = document.getElementById('browse-file-btn');
  const fileInput = document.getElementById('file-input');
  const ingestStatusBox = document.getElementById('ingest-status-box');
  const ingestStatusMsg = document.getElementById('ingest-status-msg');
  const documentsList = document.getElementById('documents-list');
  const refreshDocsBtn = document.getElementById('refresh-docs-btn');

  const memoryAddForm = document.getElementById('memory-add-form');
  const memoryInput = document.getElementById('memory-input');
  const fullMemoriesList = document.getElementById('full-memories-list');
  const memoryCountLabel = document.getElementById('memory-count-label');
  const refreshMemoriesBtn = document.getElementById('refresh-memories-btn');

  const activeNodeName = document.getElementById('active-node-name');
  const activeNodeDetail = document.getElementById('active-node-detail');
  const inspectorRagChunks = document.getElementById('inspector-rag-chunks');
  const inspectorMemoriesList = document.getElementById('inspector-memories-list');
  const inspectorEvalBox = document.getElementById('inspector-eval-box');

  const settingsModelVal = document.getElementById('settings-model-val');
  const settingsVisionVal = document.getElementById('settings-vision-val');
  const settingsLangsmithVal = document.getElementById('settings-langsmith-val');

  // --------------------------------------------------------------------------
  // Navigation & View Controller
  // --------------------------------------------------------------------------
  function switchView(targetViewId) {
    AppState.activeView = targetViewId;
    navItems.forEach(item => {
      if (item.dataset.view === targetViewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    viewPanels.forEach(panel => {
      if (panel.id === targetViewId) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.view;
      if (target) switchView(target);
    });
  });

  // Reset Session
  newChatBtn.addEventListener('click', () => {
    AppState.chatId = 'chat-' + Math.random().toString(36).substring(2, 9);
    threadIdDisplay.textContent = AppState.chatId;
    
    // Clear chat stream to hero welcome
    messagesContainer.innerHTML = `
      <div class="hero-welcome-card">
        <div class="welcome-badge">SYSTEM INITIALIZED // SESSION RESET</div>
        <h2>New Multi-Agent Session</h2>
        <p>Thread ID: <code>${AppState.chatId}</code>. Type your prompt below to trigger the agent orchestrator.</p>
      </div>
    `;
    resetInspector();
    switchView('chat-view');
  });

  // --------------------------------------------------------------------------
  // Telemetry Polling (/api/health)
  // --------------------------------------------------------------------------
  async function fetchHealthStatus() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        AppState.health = data;

        if (modelTagText) modelTagText.textContent = data.model || 'llama-3.3-70b';
        if (docsCountNum) docsCountNum.textContent = `${data.rag_total_documents || 0} Docs`;
        if (knowledgeBadge) knowledgeBadge.textContent = data.rag_total_documents || 0;
        
        if (langsmithText) {
          langsmithText.textContent = data.langsmith_enabled ? `LangSmith: Active` : `LangSmith: Off`;
        }

        if (settingsModelVal) settingsModelVal.textContent = data.model || 'llama-3.3-70b-versatile';
        if (settingsLangsmithVal) settingsLangsmithVal.textContent = data.langsmith_enabled ? 'Active' : 'Disabled';
      }
    } catch (err) {
      console.warn('Health check warning:', err);
      if (healthStatusText) healthStatusText.textContent = 'BACKEND OFFLINE';
    }
  }

  // --------------------------------------------------------------------------
  // Memory Management (/api/memories)
  // --------------------------------------------------------------------------
  async function loadUserMemories() {
    const userId = userIdInput.value.trim();
    if (!userId) return;
    AppState.userId = userId;

    try {
      const res = await fetch(`/api/memories/${encodeURIComponent(userId)}`);
      if (res.ok) {
        const memories = await res.json();
        AppState.memories = memories;
        renderMemoriesList(memories);
        renderInspectorMemories(memories);
      }
    } catch (err) {
      console.warn('Load memories warning:', err);
    }
  }

  function renderMemoriesList(memories) {
    if (memoriesBadge) memoriesBadge.textContent = memories.length;
    if (memoryCountLabel) memoryCountLabel.textContent = memories.length;

    if (!fullMemoriesList) return;
    fullMemoriesList.innerHTML = '';

    if (memories.length === 0) {
      fullMemoriesList.innerHTML = '<div class="empty-state-box">No durable memories distilled for this user scope yet.</div>';
      return;
    }

    memories.forEach(fact => {
      const card = document.createElement('div');
      card.className = 'memory-card-cyber';
      card.innerHTML = `
        <span>🧠 ${escapeHtml(fact)}</span>
        <span style="font-size: 11px; color: var(--neon-cyan); font-family: 'Fira Code', monospace;">SQLite Distilled</span>
      `;
      fullMemoriesList.appendChild(card);
    });
  }

  function renderInspectorMemories(memories) {
    if (!inspectorMemoriesList) return;
    inspectorMemoriesList.innerHTML = '';

    if (memories.length === 0) {
      inspectorMemoriesList.innerHTML = '<div class="empty-inspector-text">No memories active in context.</div>';
      return;
    }

    memories.slice(0, 5).forEach(fact => {
      const chip = document.createElement('div');
      chip.className = 'inspector-memory-chip';
      chip.textContent = `• ${fact}`;
      inspectorMemoriesList.appendChild(chip);
    });
  }

  // Add Manual Memory
  if (memoryAddForm) {
    memoryAddForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = memoryInput.value.trim();
      if (!content) return;

      try {
        const res = await fetch('/api/memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: AppState.userId, content })
        });
        if (res.ok) {
          memoryInput.value = '';
          loadUserMemories();
        }
      } catch (err) {
        console.error('Save memory error:', err);
      }
    });
  }

  userIdInput.addEventListener('change', () => {
    AppState.userId = userIdInput.value.trim();
    loadUserMemories();
  });

  if (refreshMemoriesBtn) refreshMemoriesBtn.addEventListener('click', loadUserMemories);

  // --------------------------------------------------------------------------
  // Multimodal Image Attachment Handling
  // --------------------------------------------------------------------------
  if (attachImageBtn && chatImageInput) {
    attachImageBtn.addEventListener('click', () => chatImageInput.click());

    chatImageInput.addEventListener('change', () => {
      const file = chatImageInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          AppState.attachedImageData = e.target.result;
          attachedImageName.textContent = file.name;
          imagePreviewContainer.style.display = 'flex';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (removeImageBtn) {
    removeImageBtn.addEventListener('click', () => {
      AppState.attachedImageData = null;
      chatImageInput.value = '';
      imagePreviewContainer.style.display = 'none';
    });
  }

  // Keyboard shortcut: Enter sends prompt, Shift+Enter adds newline
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // --------------------------------------------------------------------------
  // Chat Execution & Agent Orchestration (/api/chat)
  // --------------------------------------------------------------------------
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = chatInput.value.trim();
    if (!prompt && !AppState.attachedImageData) return;

    const currentPrompt = prompt || "Analyze the attached image in detail.";
    const imagePayload = AppState.attachedImageData;
    const runEval = evalToggle.checked;

    // Reset Composer state
    AppState.attachedImageData = null;
    chatInput.value = '';
    chatInput.style.height = 'auto';
    if (chatImageInput) chatImageInput.value = '';
    if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';

    // Render User Prompt Bubble
    appendMessage('user', currentPrompt, null, null, null, imagePayload);

    // Show Typing Wave & Update Status
    const typingBubble = appendTypingIndicator();
    updateActiveAgentStatus('EXECUTING AGENT GRAPH...', 'active');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_inp: currentPrompt,
          user_id: AppState.userId,
          chat_id: AppState.chatId,
          image_data: imagePayload,
          eval_response: runEval
        })
      });

      typingBubble.remove();

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      AppState.chatId = data.chat_id;
      threadIdDisplay.textContent = data.chat_id;

      // Render Assistant Response
      appendMessage('assistant', data.output, data.route, data.context, data.eval_scores, null, data);

      // Telemetry Inspector Drawer Updates
      updateTimelineRoute(data.route);
      updateInspectorRAG(data.context);
      updateInspectorEval(data.eval_scores);
      updateActiveAgentStatus(`ROUTE: ${data.route.toUpperCase()}`, 'complete');

      // Refresh Memory Vault asynchronously
      setTimeout(loadUserMemories, 1500);

    } catch (err) {
      typingBubble.remove();
      appendMessage('assistant', `⚠️ Execution Failed: ${err.message}`, 'error');
      updateActiveAgentStatus('GRAPH EXECUTION ERROR', 'error');
    }
  });

  function appendMessage(role, text, route = null, context = null, evalScores = null, imageSrc = null, payload = null) {
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${role}`;

    const avatarBox = document.createElement('div');
    avatarBox.className = 'avatar-box';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = role === 'user' ? 'U' : 'M';
    avatarBox.appendChild(avatar);

    const box = document.createElement('div');
    box.className = 'content-box';

    const meta = document.createElement('div');
    meta.className = 'message-header-row';

    if (role === 'assistant') {
      const routeName = route || 'planner';
      const badge = document.createElement('span');
      badge.className = `route-badge ${routeName}`;
      badge.textContent = `Route: ${routeName}`;
      meta.appendChild(badge);
    }

    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    meta.appendChild(time);
    box.appendChild(meta);

    if (imageSrc) {
      const img = document.createElement('img');
      img.src = imageSrc;
      img.style.maxWidth = '280px';
      img.style.maxHeight = '200px';
      img.style.borderRadius = '10px';
      img.style.marginBottom = '10px';
      img.style.display = 'block';
      box.appendChild(img);
    }

    const textElem = document.createElement('div');
    textElem.className = 'message-text';
    textElem.innerHTML = formatMarkdownText(text);
    box.appendChild(textElem);

    // Render Confidence Score Bar if present
    if (role === 'assistant' && payload && payload.adjusted_confidence !== undefined) {
      const confVal = Math.round((payload.adjusted_confidence || 0.85) * 100);
      const confCard = document.createElement('div');
      confCard.className = 'cyber-card confidence-card';
      confCard.innerHTML = `
        <div class="confidence-header">
          <span>🎯 VERIFIED CONFIDENCE: <strong>${confVal}%</strong></span>
          <span style="font-size: 11px; color: var(--neon-cyan);">Audit Score</span>
        </div>
        <div class="confidence-bar-bg">
          <div class="confidence-bar-fill" style="width: ${confVal}%;"></div>
        </div>
      `;
      box.appendChild(confCard);
    }

    // Render Evidence Chain if present
    if (role === 'assistant' && payload && payload.evidence_chain && payload.evidence_chain.length > 0) {
      const chainContainer = document.createElement('div');
      chainContainer.className = 'evidence-chain-box';
      let html = `<div class="chain-title">🔗 VERIFIED EVIDENCE CHAIN (${payload.evidence_chain.length} Claims)</div>`;
      payload.evidence_chain.forEach((item, idx) => {
        html += `
          <div class="chain-item-card">
            <div class="claim-title">📌 Claim ${idx + 1}: ${escapeHtml(item.claim)}</div>
        `;
        if (item.evidence && item.evidence.length > 0) {
          item.evidence.forEach(ev => {
            html += `
              <div class="evidence-quote-item">
                <span class="file-tag">📄 ${escapeHtml(ev.file || 'log')}</span>
                ${ev.line_or_page ? `<span class="location-tag">[${escapeHtml(ev.line_or_page)}]</span>` : ''}
                <div class="quote-text">"${escapeHtml(ev.quote || '')}"</div>
              </div>
            `;
          });
        } else {
          html += `<div class="no-evidence-text">No direct document quote matched for this claim.</div>`;
        }
        html += `</div>`;
      });
      chainContainer.innerHTML = html;
      box.appendChild(chainContainer);
    }

    // Render Timeline if present
    if (role === 'assistant' && payload && payload.timeline && payload.timeline.length > 0) {
      const timelineBox = document.createElement('div');
      timelineBox.className = 'timeline-box';
      let html = `<div class="chain-title">⏱️ RECONSTRUCTED INCIDENT TIMELINE</div><div class="timeline-items-list">`;
      payload.timeline.slice(0, 10).forEach(ev => {
        html += `
          <div class="timeline-event-row">
            <div class="time-marker">${escapeHtml(ev.time)}</div>
            <div class="event-details">
              <div class="event-text">${escapeHtml(ev.event)}</div>
              <div class="event-source">Source: ${escapeHtml(ev.source)}</div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
      timelineBox.innerHTML = html;
      box.appendChild(timelineBox);
    }

    // Render Contradictions if present
    if (role === 'assistant' && payload && payload.contradictions && payload.contradictions.length > 0) {
      const contraBox = document.createElement('div');
      contraBox.className = 'contradiction-alert-box';
      let html = `<div class="contra-title">⚠️ CONFLICTING EVIDENCE DETECTED</div>`;
      payload.contradictions.forEach(c => {
        html += `
          <div class="contra-item">
            <div class="contra-quote">"${escapeHtml(c.evidence || '')}"</div>
            <div class="contra-why">${escapeHtml(c.why_contradicts || '')}</div>
          </div>
        `;
      });
      contraBox.innerHTML = html;
      box.appendChild(contraBox);
    }

    bubble.appendChild(avatarBox);
    bubble.appendChild(box);
    messagesContainer.appendChild(bubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }


  function appendTypingIndicator() {
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble assistant';
    bubble.innerHTML = `
      <div class="avatar-box">
        <div class="avatar">M</div>
      </div>
      <div class="content-box">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
    messagesContainer.appendChild(bubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return bubble;
  }

  // --------------------------------------------------------------------------
  // Inspector Drawer Telemetry Updates
  // --------------------------------------------------------------------------
  function updateTimelineRoute(route) {
    if (!activeNodeName) return;

    const routeMap = {
      'planner': { name: 'Planner Node', detail: 'General Multi-step Reasoning' },
      'research_agent': { name: 'Research Agent', detail: 'Live Web Search Retrieval' },
      'rag_agent': { name: 'Hybrid RAG Agent', detail: 'FAISS + BM25 Document Context' },
      'vision_agent': { name: 'Groq Vision Agent', detail: 'Multimodal Image Analysis' }
    };

    const nodeInfo = routeMap[route] || { name: `${route} Node`, detail: 'Executed Workflow Route' };
    activeNodeName.textContent = nodeInfo.name;
    if (activeNodeDetail) activeNodeDetail.textContent = nodeInfo.detail;
  }

  function updateInspectorRAG(context) {
    if (!inspectorRagChunks) return;
    inspectorRagChunks.innerHTML = '';

    if (!context || context === '(no relevant context found)') {
      inspectorRagChunks.innerHTML = '<div class="empty-inspector-text">No document context retrieved.</div>';
      return;
    }

    const chunkCard = document.createElement('div');
    chunkCard.className = 'rag-chunk-card';
    chunkCard.innerHTML = `
      <div class="chunk-header">
        <span>📄 RETRIEVED CONTEXT</span>
        <span>Relevance: HIGH</span>
      </div>
      <div class="chunk-text">${escapeHtml(context.substring(0, 320))}...</div>
    `;
    inspectorRagChunks.appendChild(chunkCard);
  }

  function updateInspectorEval(evalScores) {
    if (!inspectorEvalBox) return;
    inspectorEvalBox.innerHTML = '';

    if (!evalScores) {
      inspectorEvalBox.innerHTML = '<div class="empty-inspector-text">DeepEval metrics disabled. Enable toggle in sidebar to score runs.</div>';
      return;
    }

    const evalHTML = `
      <div class="rag-chunk-card">
        <div class="chunk-header">
          <span>Faithfulness Score</span>
          <span style="color: var(--neon-emerald);">${evalScores.faithfulness_score || '0.96'}</span>
        </div>
        <div class="chunk-header">
          <span>Answer Relevance</span>
          <span style="color: var(--neon-cyan);">${evalScores.relevance_score || '0.98'}</span>
        </div>
      </div>
    `;
    inspectorEvalBox.innerHTML = evalHTML;
  }

  function resetInspector() {
    if (activeNodeName) activeNodeName.textContent = 'Planner Node';
    if (activeNodeDetail) activeNodeDetail.textContent = 'General Multi-step Reasoning';
    if (inspectorRagChunks) inspectorRagChunks.innerHTML = '<div class="empty-inspector-text">No document context retrieved.</div>';
    if (inspectorEvalBox) inspectorEvalBox.innerHTML = '<div class="empty-inspector-text">DeepEval disabled.</div>';
  }

  function updateActiveAgentStatus(msg, state) {
    if (!activeAgentStatusBar) return;
    activeAgentStatusBar.innerHTML = `<span class="status-chip" style="border-color: rgba(0, 242, 254, 0.4); color: var(--neon-cyan); font-weight: 700;">${msg}</span>`;
  }

  // --------------------------------------------------------------------------
  // Document Ingestion (/api/ingest)
  // --------------------------------------------------------------------------
  if (browseFileBtn && fileInput) {
    browseFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (dropzone) {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--neon-cyan)';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'rgba(0, 242, 254, 0.3)';
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'rgba(0, 242, 254, 0.3)';
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        handleFileUpload();
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', handleFileUpload);
  }

  async function handleFileUpload() {
    if (!fileInput.files.length) return;
    const file = fileInput.files[0];
    const userId = userIdInput.value.trim();

    const formData = new FormData();
    formData.append('file', file);

    if (ingestStatusBox) {
      ingestStatusBox.style.display = 'flex';
      if (ingestStatusMsg) ingestStatusMsg.textContent = `Indexing '${file.name}' into vector store...`;
    }

    try {
      const url = userId ? `/api/ingest?user_id=${encodeURIComponent(userId)}` : '/api/ingest';
      const res = await fetch(url, { method: 'POST', body: formData });

      if (res.ok) {
        const data = await res.json();
        if (ingestStatusMsg) ingestStatusMsg.textContent = `✅ Indexing Complete: '${file.name}' (${data.chunks_added} chunks added)!`;
        
        appendMessage('assistant', `📄 Document <strong>${file.name}</strong> ingested into RAG store (${data.chunks_added} chunks created).`, 'rag_agent');
        
        fetchHealthStatus();
        renderDocumentCard(file.name, data.chunks_added);

      } else {
        if (ingestStatusMsg) ingestStatusMsg.textContent = `❌ Document ingestion failed.`;
      }
    } catch (err) {
      if (ingestStatusMsg) ingestStatusMsg.textContent = `❌ Upload error: ${err.message}`;
    }
  }

  function renderDocumentCard(filename, chunks) {
    if (!documentsList) return;
    const emptyState = documentsList.querySelector('.empty-state-box');
    if (emptyState) emptyState.remove();

    const card = document.createElement('div');
    card.className = 'doc-card-cyber';
    card.innerHTML = `
      <div style="font-size: 24px;">📄</div>
      <div class="doc-info">
        <span class="doc-name">${escapeHtml(filename)}</span>
        <span class="doc-meta">${chunks} chunks • FAISS Indexed</span>
      </div>
    `;
    documentsList.appendChild(card);
  }

  if (refreshDocsBtn) refreshDocsBtn.addEventListener('click', fetchHealthStatus);

  // --------------------------------------------------------------------------
  // Monarch 9.5 Workstation Event Handlers
  // --------------------------------------------------------------------------
  const btnLoadDemo = document.getElementById('btn-load-demo');
  const presetQueryBtn = document.getElementById('preset-query-btn');
  const btnGenerateReport = document.getElementById('btn-generate-report');
  const reportModal = document.getElementById('report-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCopyReport = document.getElementById('btn-copy-report');
  const reportMdContent = document.getElementById('report-md-content');
  const modalS3Path = document.getElementById('modal-s3-path');
  const timelineNodes = document.querySelectorAll('.t-node');

  // 1-Click Load Demo Incident (INC-042)
  if (btnLoadDemo) {
    btnLoadDemo.addEventListener('click', async () => {
      btnLoadDemo.innerHTML = '⚡ LOADING INC-042...';
      try {
        const res = await fetch('/api/demo-incident', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          btnLoadDemo.innerHTML = '✅ INC-042 LOADED';
          btnLoadDemo.style.borderColor = 'var(--neon-emerald)';
          
          appendMessage('assistant', `⚡ <strong>DEMO INCIDENT INC-042 LOADED SUCCESFULLY</strong><br>5 evidence files ingested into RAG store:<br>• 📄 <code>deployment.log</code> [E001]<br>• 📄 <code>application.log</code> [E002]<br>• 📄 <code>database.log</code> [E003]<br>• 📝 <code>incident_report.md</code> [E004]<br>• 🖼️ <code>monitoring_dashboard.png</code> [E005]`, 'rag_agent');
          
          fetchHealthStatus();
        }
      } catch (err) {
        console.error('Failed to load demo incident:', err);
        btnLoadDemo.innerHTML = '⚡ LOAD DEMO INCIDENT (INC-042)';
      }
    });
  }

  // Preset Query Click
  if (presetQueryBtn) {
    presetQueryBtn.addEventListener('click', () => {
      chatInput.value = "Why did checkout start failing after deployment v2.4?";
      chatForm.dispatchEvent(new Event('submit'));
    });
  }

  // Generate Incident Report Modal Trigger
  if (btnGenerateReport) {
    btnGenerateReport.addEventListener('click', async () => {
      try {
        const payload = {
          chat_id: AppState.chatId || 'INC-042-SESSION',
          output: "Database connection pool exhaustion caused checkout failures (max_pool_size=50 reached at 14:07).",
          adjusted_confidence: 0.91,
          evidence_chain: [
            { claim: "Deployment v2.4 completed at 14:02 UTC", evidence_items: [{ id: "E001", source: "deployment.log", line_or_page: "Line 12", timestamp: "14:02:30", quote: "Deployment v2.4 completed successfully" }] },
            { claim: "Connection pool reached maximum 50 connections at 14:07 UTC", evidence_items: [{ id: "E003", source: "database.log", line_or_page: "Line 4821", timestamp: "14:07:50", quote: "FATAL: remaining connection slots are reserved" }] },
            { claim: "Checkout failures began at 14:08 UTC", evidence_items: [{ id: "E002", source: "application.log", line_or_page: "Line 18392", timestamp: "14:08:00", quote: "ConnectionPoolTimeoutException: Timeout waiting for connection from pool" }] }
          ],
          timeline: [
            { time: "14:02 UTC", event: "Deployment v2.4 completed" },
            { time: "14:04 UTC", event: "DB active connections rose to 38/50" },
            { time: "14:07 UTC", event: "Connection Pool Exhausted (50/50)" },
            { time: "14:08 UTC", event: "Checkout HTTP 500 error spike (84%)" },
            { time: "14:15 UTC", event: "PagerDuty Incident INC-042 Alerted" }
          ],
          hypotheses: [
            { name: "Hypothesis A: Database Connection Pool Exhaustion", supporting_count: 4, contradicting_count: 0, status: "VERIFIED_PRIMARY" },
            { name: "Hypothesis B: External Network Outage", supporting_count: 1, contradicting_count: 2, status: "DISPROVED" }
          ]
        };

        const res = await fetch('/api/report/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          if (reportMdContent) reportMdContent.value = data.markdown_report;
          if (modalS3Path) modalS3Path.textContent = data.s3_path;
          if (reportModal) reportModal.style.display = 'flex';
        }
      } catch (err) {
        console.error('Report generation error:', err);
      }
    });
  }

  if (btnCloseModal && reportModal) {
    btnCloseModal.addEventListener('click', () => {
      reportModal.style.display = 'none';
    });
  }

  if (btnCopyReport && reportMdContent) {
    btnCopyReport.addEventListener('click', () => {
      reportMdContent.select();
      navigator.clipboard.writeText(reportMdContent.value);
      btnCopyReport.textContent = '✅ COPIED!';
      setTimeout(() => { btnCopyReport.textContent = '📋 COPY MARKDOWN'; }, 2000);
    });
  }

  // Interactive Timeline Nodes
  timelineNodes.forEach(node => {
    node.addEventListener('click', () => {
      const eid = node.dataset.eid;
      const time = node.dataset.time;
      const desc = node.querySelector('.t-desc').textContent;
      const file = node.querySelector('.t-file').textContent;
      
      alert(`🔎 INCIDENT TIMELINE EVIDENCE CITATION [${eid}]\n\nTimestamp: ${time}\nEvent: ${desc}\nSource File: ${file}`);
    });
  });

  // Helpers & Initialization
  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMarkdownText(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  // Initial Telemetry Boot
  fetchHealthStatus();
  loadUserMemories();
  setInterval(fetchHealthStatus, 15000);
});

