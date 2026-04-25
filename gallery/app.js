const { computed, createApp, onBeforeUnmount, onMounted, ref, watch } = Vue;

const REPO_URL = 'https://github.com/EvoLinkAI/awesome-gpt-image-2-prompts';
const TOOL_URL = '../tools/image-generator.html';
const SOURCE_LABEL = 'awesome-gpt-image-2-prompts';
const AUTHOR_ALL = '全部作者';
const SECTION_ALL = '全部分类';
const SOURCE_ALL = '全部来源';
const STORAGE_KEY = 'gpt-image-2-gallery-editor-v1';
const STORAGE_BACKUPS_KEY = 'gpt-image-2-gallery-backups-v1';
const BACKUP_LIMIT = 12;
const PLACEHOLDER_CACHE = new Map();
const EDITOR_ENABLED =
  window.location.protocol === 'file:' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';
const BASE_SOURCES = [
  { key: 'curated', label: '当前站内', name: '当前站内精选' },
  { key: 'github-raw', label: 'GitHub 原始', name: 'awesome-gpt-image-2-prompts 原始补充' },
  { key: 'opennana', label: 'OpenNana', name: 'OpenNana ChatGPT 图库' },
];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeTrim(value) {
  return String(value ?? '').trim();
}

function slugify(value) {
  return safeTrim(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function buildPromptExcerpt(prompt) {
  const text = safeTrim(prompt).replace(/\s+/g, ' ');
  if (!text) {
    return '暂无提示词，可点击编辑补充。';
  }
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => safeTrim(item)).filter(Boolean);
  }
  return String(value ?? '')
    .split(/[\n,，、]/)
    .map((item) => safeTrim(item))
    .filter(Boolean);
}

function buildSearchIndex(item) {
  return [
    item.title,
    item.category,
    item.authorHandle,
    item.prompt,
    item.sourceUrl,
    item.sourceLabel,
    item.sourceName,
    ...(item.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function createPlaceholderDataUrl(item) {
  const key = item?.id || `${item?.title || 'placeholder'}-${item?.category || ''}`;
  if (PLACEHOLDER_CACHE.has(key)) {
    return PLACEHOLDER_CACHE.get(key);
  }

  const title = (safeTrim(item?.title) || '暂无图片').slice(0, 26);
  const category = (safeTrim(item?.category) || '等待补充').slice(0, 24);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1125">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#efe7db" />
          <stop offset="100%" stop-color="#d9d2c5" />
        </linearGradient>
      </defs>
      <rect width="900" height="1125" fill="url(#bg)" />
      <circle cx="160" cy="180" r="120" fill="rgba(155,77,47,0.10)" />
      <circle cx="760" cy="940" r="180" fill="rgba(106,150,142,0.12)" />
      <rect x="86" y="120" width="728" height="885" rx="44" fill="rgba(255,255,255,0.72)" stroke="rgba(24,21,18,0.10)" />
      <text x="450" y="420" text-anchor="middle" font-family="Segoe UI, PingFang SC, sans-serif" font-size="42" fill="#6b6157">图片暂不可用</text>
      <text x="450" y="492" text-anchor="middle" font-family="Segoe UI, PingFang SC, sans-serif" font-size="26" fill="#9b4d2f">${title.replace(/[<&>]/g, '')}</text>
      <text x="450" y="548" text-anchor="middle" font-family="Segoe UI, PingFang SC, sans-serif" font-size="20" fill="#6b6157">${category.replace(/[<&>]/g, '')}</text>
      <text x="450" y="908" text-anchor="middle" font-family="Segoe UI, PingFang SC, sans-serif" font-size="20" fill="#7f7469">可以在网页编辑里补图或替换 URL</text>
    </svg>
  `;
  const dataUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  PLACEHOLDER_CACHE.set(key, dataUrl);
  return dataUrl;
}

function normalizeCase(raw, sectionTitle = '') {
  const title = safeTrim(raw?.title) || '未命名案例';
  const category = safeTrim(raw?.category) || safeTrim(sectionTitle) || '未分类新增';
  const prompt = safeTrim(raw?.prompt);
  const tags = parseTags(raw?.tags);
  const sourceKey = safeTrim(raw?.sourceKey);
  const sourcePreset = BASE_SOURCES.find((item) => item.key === sourceKey);

  const normalized = {
    id: safeTrim(raw?.id) || `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    caseNumber: raw?.caseNumber ?? null,
    title,
    sourceUrl: safeTrim(raw?.sourceUrl),
    authorHandle: safeTrim(raw?.authorHandle) || '未署名',
    authorUrl: safeTrim(raw?.authorUrl),
    imageUrl: safeTrim(raw?.imageUrl),
    fallbackImageUrl: safeTrim(raw?.fallbackImageUrl),
    prompt,
    promptExcerpt: safeTrim(raw?.promptExcerpt) || buildPromptExcerpt(prompt),
    category,
    sourceKey,
    sourceName: safeTrim(raw?.sourceName) || sourcePreset?.name || '未标记来源',
    sourceLabel: safeTrim(raw?.sourceLabel) || sourcePreset?.label || '未标记',
    tags,
    imageCount: Math.max(1, Number.parseInt(raw?.imageCount, 10) || 1),
  };

  normalized.searchIndex = safeTrim(raw?.searchIndex) || buildSearchIndex(normalized);

  if (!normalized.fallbackImageUrl && normalized.imageUrl) {
    normalized.fallbackImageUrl = normalized.imageUrl;
  }

  return normalized;
}

function normalizeSections(rawSections) {
  return (Array.isArray(rawSections) ? rawSections : [])
    .map((section, index) => {
      const title = safeTrim(section?.title) || safeTrim(section?.id) || `未分类分区 ${index + 1}`;
      const cases = (Array.isArray(section?.cases) ? section.cases : [])
        .map((item) => normalizeCase(item, title));
      return {
        id: safeTrim(section?.id) || `section-${slugify(title) || index + 1}`,
        title,
        cases,
      };
    })
    .filter((section) => section.title);
}

function stripRemovedSources(rawSections) {
  return normalizeSections(rawSections)
    .map((section) => ({
      ...section,
      cases: (section.cases || []).filter((item) => item.sourceKey !== 'x-likes' && item.sourceLabel !== 'X 喜欢'),
    }))
    .filter((section) => section.cases.length > 0 && !section.title.includes('X 喜欢'));
}

function buildLibraryMeta(baseMeta, sections) {
  const allCases = sections.flatMap((section) => section.cases || []);
  const baseSources = Array.isArray(baseMeta?.sources) && baseMeta.sources.length
    ? baseMeta.sources
    : BASE_SOURCES;
  const sources = [...baseSources];

  for (const item of allCases) {
    const key = safeTrim(item.sourceKey) || slugify(item.sourceLabel) || `source-${sources.length + 1}`;
    const exists = sources.some((source) => source.key === key);
    if (!exists) {
      sources.push({
        key,
        label: safeTrim(item.sourceLabel) || '未标记',
        name: safeTrim(item.sourceName) || safeTrim(item.sourceLabel) || '未标记来源',
      });
    }
  }

  return {
    ...(baseMeta || {}),
    dataVersion: safeTrim(baseMeta?.dataVersion) || new Date().toISOString().slice(0, 10),
    sectionCount: sections.length,
    sourceCount: sources.length,
    totalCases: allCases.length,
    sources,
  };
}

function loadStoredSections(defaultSections) {
  const fallbackSections = stripRemovedSources(defaultSections);
  if (!EDITOR_ENABLED) {
    return fallbackSections;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallbackSections;
    }
    const parsed = JSON.parse(raw);
    const migrated = stripRemovedSources(parsed);
    return migrated.length ? migrated : fallbackSections;
  } catch {
    return fallbackSections;
  }
}

function buildExportPayload(meta, sections) {
  return [
    `window.CASE_LIBRARY_META = ${JSON.stringify(meta, null, 2)};`,
    '',
    `window.CASE_LIBRARY = ${JSON.stringify(sections, null, 2)};`,
    '',
  ].join('\n');
}

function loadBackups() {
  if (!EDITOR_ENABLED) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_BACKUPS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : [])
      .map((item) => ({
        id: safeTrim(item?.id) || `backup-${Date.now()}`,
        label: safeTrim(item?.label) || '未命名备份',
        createdAt: safeTrim(item?.createdAt) || new Date().toISOString(),
        meta: item?.meta || null,
        sections: stripRemovedSources(item?.sections || []),
      }))
      .filter((item) => item.sections.length > 0);
  } catch {
    return [];
  }
}

function saveBackups(backups) {
  if (!EDITOR_ENABLED) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_BACKUPS_KEY, JSON.stringify(backups.slice(0, BACKUP_LIMIT)));
  } catch {
    // ignore quota errors for backup persistence; regular editor notice handles primary save path
  }
}

function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function parseImportPayload(text) {
  const trimmed = safeTrim(text);
  if (!trimmed) {
    throw new Error('导入文件为空');
  }

  if (trimmed.startsWith('window.CASE_LIBRARY_META')) {
    const meta = JSON.parse(trimmed.split('window.CASE_LIBRARY = ')[0].split('=', 1)[1].trim().replace(/;$/, ''));
    const sections = JSON.parse(trimmed.split('window.CASE_LIBRARY = ', 1)[1].trim().replace(/;$/, ''));
    return { meta, sections };
  }

  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) {
    return { meta: null, sections: parsed };
  }
  if (parsed && Array.isArray(parsed.sections)) {
    return { meta: parsed.meta || null, sections: parsed.sections };
  }

  throw new Error('暂不支持该导入格式，请导入 JSON 数组、{ meta, sections } 或导出的 data.js');
}

createApp({
  setup() {
    const defaultSections = normalizeSections(window.CASE_LIBRARY || []);
    const baseMeta = ref(window.CASE_LIBRARY_META || {});
    const loading = ref(false);
    const error = ref('');
    const sections = ref(loadStoredSections(defaultSections));
    const query = ref('');
    const activeCategory = ref(SECTION_ALL);
    const activeAuthor = ref(AUTHOR_ALL);
    const activeSource = ref(SOURCE_ALL);
    const selectedCase = ref(null);
    const copiedCaseId = ref('');
    const featuredIndex = ref(0);
    const isEditing = ref(false);
    const editorVisible = ref(false);
    const editorMode = ref('create');
    const editorOriginalId = ref('');
    const editorNotice = ref('');
    const hasLocalEdits = ref(EDITOR_ENABLED && Boolean(window.localStorage.getItem(STORAGE_KEY)));
    const backups = ref(loadBackups());
    const previewVisible = ref(false);
    const editorForm = ref(createEmptyEditorForm());
    const importInput = ref(null);

    if (!sections.value.length) {
      error.value = '本地案例数据未加载成功，请确认 data.js 与 index.html 在同一目录中。';
    }

    const libraryMeta = computed(() => buildLibraryMeta(baseMeta.value, sections.value));
    const allCases = computed(() => sections.value.flatMap((section) => section.cases || []));

    const authorOptions = computed(() => {
      const counts = new Map();
      for (const item of allCases.value) {
        counts.set(item.authorHandle, (counts.get(item.authorHandle) ?? 0) + 1);
      }
      return [
        { handle: AUTHOR_ALL, total: allCases.value.length },
        ...[...counts.entries()]
          .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
          .map(([handle, total]) => ({ handle, total })),
      ];
    });

    const sourceOptions = computed(() => {
      const counts = new Map();
      for (const item of allCases.value) {
        const key = item.sourceLabel || item.sourceName || '未标记';
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const preferredOrder = (libraryMeta.value.sources || []).map((source) => source.label);
      const sorted = [...counts.entries()].sort((left, right) => {
        const leftIndex = preferredOrder.indexOf(left[0]);
        const rightIndex = preferredOrder.indexOf(right[0]);
        if (leftIndex !== -1 || rightIndex !== -1) {
          return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
        }
        return right[1] - left[1] || left[0].localeCompare(right[0]);
      });
      return [
        { label: SOURCE_ALL, total: allCases.value.length },
        ...sorted.map(([label, total]) => ({ label, total })),
      ];
    });

    const editorSourceOptions = computed(() => libraryMeta.value.sources || BASE_SOURCES);
    const dataJsPreview = computed(() => buildExportPayload(libraryMeta.value, sections.value));

    const filteredSections = computed(() => {
      const normalizedQuery = query.value.trim().toLowerCase();

      return sections.value
        .map((section) => {
          const cases = (section.cases || []).filter((item) => {
            const matchesCategory =
              activeCategory.value === SECTION_ALL || item.category === activeCategory.value;
            const matchesAuthor =
              activeAuthor.value === AUTHOR_ALL || item.authorHandle === activeAuthor.value;
            const matchesSource =
              activeSource.value === SOURCE_ALL || (item.sourceLabel || item.sourceName) === activeSource.value;
            const matchesQuery =
              !normalizedQuery || (item.searchIndex || '').includes(normalizedQuery);

            return matchesCategory && matchesAuthor && matchesSource && matchesQuery;
          });

          return { ...section, cases };
        })
        .filter((section) => section.cases.length > 0);
    });

    const filteredCases = computed(() => filteredSections.value.flatMap((section) => section.cases));

    const featuredCases = computed(() => {
      const sourcePriority = {
        '当前站内': 0,
        'GitHub 原始': 1,
        OpenNana: 2,
      };
      return [...allCases.value]
        .sort((left, right) => {
          const leftPriority = sourcePriority[left.sourceLabel] ?? 99;
          const rightPriority = sourcePriority[right.sourceLabel] ?? 99;
          if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority;
          }
          return (right.imageCount || 1) - (left.imageCount || 1);
        })
        .slice(0, 8);
    });

    const activeFeaturedCase = computed(() => {
      if (!featuredCases.value.length) {
        return null;
      }
      return featuredCases.value[featuredIndex.value % featuredCases.value.length];
    });

    const totalAuthors = computed(
      () => authorOptions.value.filter((item) => item.handle !== AUTHOR_ALL).length,
    );

    const stats = computed(() => [
      {
        label: '总案例数',
        value: libraryMeta.value.totalCases || allCases.value.length || '--',
      },
      {
        label: '当前分区',
        value: libraryMeta.value.sectionCount || sections.value.length || '--',
      },
      {
        label: '作者数量',
        value: totalAuthors.value || '--',
      },
      {
        label: '数据来源',
        value: libraryMeta.value.sourceCount || sourceOptions.value.length - 1 || '--',
      },
    ]);

    const selectedCaseIndex = computed(() =>
      selectedCase.value
        ? filteredCases.value.findIndex((item) => item.id === selectedCase.value.id)
        : -1,
    );

    const hasPreviousCase = computed(() => selectedCaseIndex.value > 0);
    const hasNextCase = computed(
      () => selectedCaseIndex.value >= 0 && selectedCaseIndex.value < filteredCases.value.length - 1,
    );

    function createEmptyEditorForm(category = '') {
      return {
        title: '',
        category: category || (sections.value[0]?.title || '未分类新增'),
        sourceKey: 'curated',
        sourceLabel: '当前站内',
        sourceName: '当前站内精选',
        sourceUrl: '',
        authorHandle: '',
        authorUrl: '',
        imageUrl: '',
        fallbackImageUrl: '',
        prompt: '',
        tagsText: '',
        imageCount: 1,
      };
    }

    function showEditorNotice(message) {
      editorNotice.value = message;
      window.clearTimeout(showEditorNotice.timer);
      showEditorNotice.timer = window.setTimeout(() => {
        if (editorNotice.value === message) {
          editorNotice.value = '';
        }
      }, 2400);
    }
    showEditorNotice.timer = 0;

    function formatBackupTime(isoString) {
      try {
        return new Date(isoString).toLocaleString('zh-CN', {
          hour12: false,
        });
      } catch {
        return isoString;
      }
    }

    function createBackupSnapshot(label, sectionsOverride = sections.value, metaOverride = libraryMeta.value) {
      if (!EDITOR_ENABLED) {
        return;
      }
      const normalizedSections = stripRemovedSources(sectionsOverride);
      if (!normalizedSections.length) {
        return;
      }
      const snapshot = {
        id: `backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: safeTrim(label) || '本地备份',
        createdAt: new Date().toISOString(),
        meta: deepClone(metaOverride),
        sections: deepClone(normalizedSections),
      };
      backups.value = [snapshot, ...backups.value].slice(0, BACKUP_LIMIT);
      saveBackups(backups.value);
    }

    function persistSections(nextSections, message = '已保存到当前浏览器') {
      const normalized = stripRemovedSources(nextSections)
        .filter((section) => (section.cases || []).length > 0 || safeTrim(section.title));
      sections.value = normalized.filter((section) => section.cases.length > 0);
      if (!EDITOR_ENABLED) {
        showEditorNotice('当前环境未开启编辑保存');
        return;
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sections.value));
        hasLocalEdits.value = true;
        createBackupSnapshot(message, sections.value, libraryMeta.value);
      } catch {
        showEditorNotice('浏览器不允许写入 localStorage，修改仅保留当前会话');
      }
      showEditorNotice(message);
    }

    function getImageSrc(item) {
      return safeTrim(item?.imageUrl) || safeTrim(item?.fallbackImageUrl) || createPlaceholderDataUrl(item);
    }

    function applySourcePreset(sourceKey) {
      const preset = editorSourceOptions.value.find((item) => item.key === sourceKey);
      if (!preset) {
        return;
      }
      editorForm.value.sourceKey = preset.key;
      editorForm.value.sourceLabel = preset.label;
      editorForm.value.sourceName = preset.name;
    }

    async function copyPrompt(item) {
      try {
        await navigator.clipboard.writeText(item.prompt || '');
        copiedCaseId.value = item.id;
        window.setTimeout(() => {
          if (copiedCaseId.value === item.id) {
            copiedCaseId.value = '';
          }
        }, 1800);
      } catch {
        copiedCaseId.value = '';
      }
    }

    function openCase(item) {
      selectedCase.value = item;
      document.body.classList.add('modal-open');
    }

    function closeCase() {
      selectedCase.value = null;
      document.body.classList.remove('modal-open');
    }

    function moveCase(step) {
      const nextIndex = selectedCaseIndex.value + step;
      if (nextIndex < 0 || nextIndex >= filteredCases.value.length) {
        return;
      }
      selectedCase.value = filteredCases.value[nextIndex];
    }

    function setCategory(category) {
      activeCategory.value = category;
    }

    function setAuthor(handle) {
      activeAuthor.value = handle;
    }

    function setSource(label) {
      activeSource.value = label;
    }

    function resetFilters() {
      query.value = '';
      activeCategory.value = SECTION_ALL;
      activeAuthor.value = AUTHOR_ALL;
      activeSource.value = SOURCE_ALL;
    }

    function cycleFeatured() {
      if (featuredCases.value.length <= 1) {
        return;
      }
      if (window.scrollY > 120) {
        return;
      }
      featuredIndex.value = (featuredIndex.value + 1) % featuredCases.value.length;
    }

    function handleKeydown(event) {
      if (editorVisible.value && event.key === 'Escape') {
        closeEditor();
        return;
      }
      if (previewVisible.value && event.key === 'Escape') {
        closePreview();
        return;
      }
      if (!selectedCase.value) {
        return;
      }
      if (event.key === 'Escape') {
        closeCase();
      }
      if (event.key === 'ArrowRight') {
        moveCase(1);
      }
      if (event.key === 'ArrowLeft') {
        moveCase(-1);
      }
    }

    function handleImageError(event, item) {
      const currentTarget = event.target;
      const fallback = safeTrim(item?.fallbackImageUrl);
      const placeholder = createPlaceholderDataUrl(item);

      if (fallback && currentTarget.dataset.fallbackApplied !== '1' && currentTarget.src !== fallback) {
        currentTarget.dataset.fallbackApplied = '1';
        currentTarget.src = fallback;
        return;
      }

      currentTarget.dataset.placeholderApplied = '1';
      currentTarget.src = placeholder;
    }

    function toggleEditMode() {
      if (!EDITOR_ENABLED) {
        return;
      }
      isEditing.value = !isEditing.value;
      showEditorNotice(isEditing.value ? '编辑模式已开启' : '已退出编辑模式');
    }

    function openCreateEditor(categoryOverride = '') {
      if (!EDITOR_ENABLED) {
        return;
      }
      editorMode.value = 'create';
      editorOriginalId.value = '';
      editorForm.value = createEmptyEditorForm(
        categoryOverride || (activeCategory.value !== SECTION_ALL ? activeCategory.value : sections.value[0]?.title),
      );
      applySourcePreset(editorForm.value.sourceKey);
      editorVisible.value = true;
      document.body.classList.add('modal-open');
    }

    function openEditEditor(item) {
      if (!EDITOR_ENABLED) {
        return;
      }
      editorMode.value = 'edit';
      editorOriginalId.value = item.id;
      editorForm.value = {
        title: item.title || '',
        category: item.category || sections.value[0]?.title || '未分类新增',
        sourceKey: item.sourceKey || 'curated',
        sourceLabel: item.sourceLabel || '',
        sourceName: item.sourceName || '',
        sourceUrl: item.sourceUrl || '',
        authorHandle: item.authorHandle || '',
        authorUrl: item.authorUrl || '',
        imageUrl: item.imageUrl || '',
        fallbackImageUrl: item.fallbackImageUrl || '',
        prompt: item.prompt || '',
        tagsText: (item.tags || []).join(', '),
        imageCount: item.imageCount || 1,
      };
      editorVisible.value = true;
      document.body.classList.add('modal-open');
    }

    function closeEditor() {
      editorVisible.value = false;
      if (!selectedCase.value) {
        document.body.classList.remove('modal-open');
      }
    }

    function openPreview() {
      if (!EDITOR_ENABLED) {
        return;
      }
      previewVisible.value = true;
      document.body.classList.add('modal-open');
    }

    function closePreview() {
      previewVisible.value = false;
      if (!selectedCase.value && !editorVisible.value) {
        document.body.classList.remove('modal-open');
      }
    }

    function buildCaseFromEditor() {
      const tags = parseTags(editorForm.value.tagsText);
      const normalized = normalizeCase({
        id: editorOriginalId.value || undefined,
        title: editorForm.value.title,
        category: editorForm.value.category,
        sourceKey: editorForm.value.sourceKey,
        sourceLabel: editorForm.value.sourceLabel,
        sourceName: editorForm.value.sourceName,
        sourceUrl: editorForm.value.sourceUrl,
        authorHandle: editorForm.value.authorHandle,
        authorUrl: editorForm.value.authorUrl,
        imageUrl: editorForm.value.imageUrl,
        fallbackImageUrl: editorForm.value.fallbackImageUrl,
        prompt: editorForm.value.prompt,
        tags,
        imageCount: editorForm.value.imageCount,
      }, editorForm.value.category);
      normalized.promptExcerpt = buildPromptExcerpt(normalized.prompt);
      normalized.searchIndex = buildSearchIndex(normalized);
      if (!editorOriginalId.value) {
        normalized.id = `custom-${slugify(normalized.category || 'case')}-${Date.now()}`;
      }
      return normalized;
    }

    function saveEditor() {
      const nextCase = buildCaseFromEditor();
      const targetCategory = nextCase.category;
      const shouldRefreshSelectedCase =
        editorMode.value === 'edit' && selectedCase.value?.id === editorOriginalId.value;
      const nextSections = deepClone(sections.value);
      let originalSectionTitle = '';
      let originalIndex = -1;

      nextSections.forEach((section) => {
        const index = section.cases.findIndex((item) => item.id === editorOriginalId.value);
        if (index !== -1) {
          originalSectionTitle = section.title;
          originalIndex = index;
          section.cases.splice(index, 1);
        }
      });

      let targetSection = nextSections.find((section) => section.title === targetCategory);
      if (!targetSection) {
        targetSection = {
          id: `section-${slugify(targetCategory) || Date.now()}`,
          title: targetCategory,
          cases: [],
        };
        nextSections.push(targetSection);
      }

      if (editorMode.value === 'edit' && originalSectionTitle === targetCategory && originalIndex !== -1) {
        targetSection.cases.splice(Math.min(originalIndex, targetSection.cases.length), 0, nextCase);
      } else {
        targetSection.cases.unshift(nextCase);
      }

      persistSections(nextSections, editorMode.value === 'edit' ? '案例已更新' : '案例已新增');
      if (shouldRefreshSelectedCase) {
        const replacement = sections.value
          .flatMap((section) => section.cases)
          .find((item) => item.id === nextCase.id);
        selectedCase.value = replacement || nextCase;
      }
      closeEditor();
    }

    function deleteCase(item) {
      if (!EDITOR_ENABLED) {
        return;
      }
      const confirmed = window.confirm(`确认删除「${item.title}」吗？此操作只影响当前浏览器。`);
      if (!confirmed) {
        return;
      }
      const nextSections = deepClone(sections.value)
        .map((section) => ({
          ...section,
          cases: section.cases.filter((entry) => entry.id !== item.id),
        }))
        .filter((section) => section.cases.length > 0);
      persistSections(nextSections, '案例已删除');
      if (selectedCase.value?.id === item.id) {
        closeCase();
      }
      if (editorVisible.value && editorOriginalId.value === item.id) {
        closeEditor();
      }
    }

    function deleteCurrentEditorCase() {
      if (!editorOriginalId.value) {
        return;
      }
      deleteCase({
        id: editorOriginalId.value,
        title: editorForm.value.title || '当前案例',
      });
    }

    function resetLocalEdits() {
      if (!EDITOR_ENABLED) {
        return;
      }
      const confirmed = window.confirm('确认恢复为默认数据吗？当前浏览器里的所有编辑都会被清空。');
      if (!confirmed) {
        return;
      }
      if (sections.value.length) {
        createBackupSnapshot('清空本地编辑前备份', sections.value, libraryMeta.value);
      }
      sections.value = normalizeSections(defaultSections);
      window.localStorage.removeItem(STORAGE_KEY);
      hasLocalEdits.value = false;
      closeEditor();
      showEditorNotice('已恢复默认数据');
      if (selectedCase.value) {
        const replacement = sections.value
          .flatMap((section) => section.cases)
          .find((item) => item.id === selectedCase.value.id);
        if (replacement) {
          selectedCase.value = replacement;
        } else {
          closeCase();
        }
      }
    }

    function exportCurrentDataJs() {
      if (!EDITOR_ENABLED) {
        return;
      }
      const payload = buildExportPayload(libraryMeta.value, sections.value);
      triggerDownload(
        `gpt-image-2-gallery-data-${new Date().toISOString().slice(0, 10)}.js`,
        payload,
        'application/javascript;charset=utf-8',
      );
      showEditorNotice('当前数据已导出为 data.js');
    }

    function exportCurrentJson() {
      if (!EDITOR_ENABLED) {
        return;
      }
      const payload = JSON.stringify(
        {
          meta: libraryMeta.value,
          sections: sections.value,
        },
        null,
        2,
      );
      triggerDownload(
        `gpt-image-2-gallery-data-${new Date().toISOString().slice(0, 10)}.json`,
        payload,
        'application/json;charset=utf-8',
      );
      showEditorNotice('当前数据已导出为 JSON');
    }

    function openImportDialog() {
      if (!EDITOR_ENABLED) {
        return;
      }
      importInput.value?.click();
    }

    async function handleImportFile(event) {
      if (!EDITOR_ENABLED) {
        return;
      }
      const file = event.target?.files?.[0];
      if (!file) {
        return;
      }

      try {
        const confirmed = window.confirm('导入会替换当前浏览器里的本地编辑数据，是否继续？');
        if (!confirmed) {
          return;
        }
        if (sections.value.length) {
          createBackupSnapshot(`导入 ${file.name} 前备份`, sections.value, libraryMeta.value);
        }
        const text = await file.text();
        const parsed = parseImportPayload(text);
        baseMeta.value = parsed.meta || baseMeta.value;
        persistSections(parsed.sections, `已导入 ${file.name}`);
      } catch (importError) {
        showEditorNotice(importError?.message || '导入失败，请检查文件格式');
      } finally {
        event.target.value = '';
      }
    }

    async function copyDataJsPreview() {
      if (!EDITOR_ENABLED) {
        return;
      }
      try {
        await navigator.clipboard.writeText(dataJsPreview.value);
        showEditorNotice('data.js 预览已复制到剪贴板');
      } catch {
        showEditorNotice('复制失败，请手动复制预览内容');
      }
    }

    function downloadDataJsPreview() {
      exportCurrentDataJs();
    }

    function restoreBackup(backup) {
      if (!EDITOR_ENABLED) {
        return;
      }
      const confirmed = window.confirm(`确认恢复备份「${backup.label}」吗？当前本地数据会被替换。`);
      if (!confirmed) {
        return;
      }
      if (sections.value.length) {
        createBackupSnapshot(`恢复备份「${backup.label}」前`, sections.value, libraryMeta.value);
      }
      baseMeta.value = backup.meta || baseMeta.value;
      persistSections(backup.sections, `已恢复备份：${backup.label}`);
    }

    function deleteBackup(backupId) {
      if (!EDITOR_ENABLED) {
        return;
      }
      backups.value = backups.value.filter((item) => item.id !== backupId);
      saveBackups(backups.value);
      showEditorNotice('备份已删除');
    }

    function exportBackupJson(backup) {
      if (!EDITOR_ENABLED) {
        return;
      }
      const payload = JSON.stringify(
        {
          meta: backup.meta,
          sections: backup.sections,
        },
        null,
        2,
      );
      triggerDownload(
        `gpt-image-2-backup-${safeTrim(backup.createdAt).slice(0, 10) || 'snapshot'}.json`,
        payload,
        'application/json;charset=utf-8',
      );
      showEditorNotice(`已导出备份：${backup.label}`);
    }

    let featuredTimer = 0;

    onMounted(() => {
      window.addEventListener('keydown', handleKeydown);
      featuredTimer = window.setInterval(cycleFeatured, 5200);
    });

    onBeforeUnmount(() => {
      window.removeEventListener('keydown', handleKeydown);
      window.clearInterval(featuredTimer);
      window.clearTimeout(showEditorNotice.timer);
      document.body.classList.remove('modal-open');
    });

    watch([activeCategory, activeAuthor, activeSource, query], () => {
      if (selectedCase.value) {
        const exists = filteredCases.value.some((item) => item.id === selectedCase.value.id);
        if (!exists) {
          selectedCase.value = null;
          if (!editorVisible.value) {
            document.body.classList.remove('modal-open');
          }
        }
      }
    });

    return {
      SOURCE_LABEL,
      REPO_URL,
      TOOL_URL,
      AUTHOR_ALL,
      SECTION_ALL,
      SOURCE_ALL,
      loading,
      error,
      sections,
      stats,
      query,
      activeCategory,
      activeAuthor,
      activeSource,
      authorOptions,
      sourceOptions,
      editorSourceOptions,
      filteredSections,
      filteredCases,
      selectedCase,
      copiedCaseId,
      activeFeaturedCase,
      hasPreviousCase,
      hasNextCase,
      libraryMeta,
      isEditing,
      editorVisible,
      editorMode,
      editorForm,
      editorNotice,
      hasLocalEdits,
      backups,
      previewVisible,
      dataJsPreview,
      editorAvailable: EDITOR_ENABLED,
      importInput,
      copyPrompt,
      openCase,
      closeCase,
      moveCase,
      setCategory,
      setAuthor,
      setSource,
      resetFilters,
      handleImageError,
      getImageSrc,
      toggleEditMode,
      openCreateEditor,
      openEditEditor,
      closeEditor,
      openPreview,
      closePreview,
      saveEditor,
      deleteCase,
      deleteCurrentEditorCase,
      resetLocalEdits,
      exportCurrentDataJs,
      exportCurrentJson,
      openImportDialog,
      handleImportFile,
      copyDataJsPreview,
      downloadDataJsPreview,
      restoreBackup,
      deleteBackup,
      exportBackupJson,
      formatBackupTime,
      applySourcePreset,
    };
  },
  template: `
    <div class="page-shell">
      <div class="ambient ambient-a"></div>
      <div class="ambient ambient-b"></div>

      <header class="hero">
        <div class="hero-copy">
          <div class="eyebrow">Unified Prompt Library</div>
          <h1>
            <span class="hero-title-line">GPT-Image-2</span>
            <span class="hero-title-line">案例观察库</span>
          </h1>
          <p class="hero-text">
            现在这套静态 Vue 页面已经把
            <a :href="REPO_URL" target="_blank" rel="noreferrer">{{ SOURCE_LABEL }}</a>
            原有案例、GitHub 原始补充，以及 OpenNana ChatGPT 图库整合到同一套卡片布局里，统一展示图片、作者与提示词。
          </p>

          <div class="hero-actions">
            <a class="button primary" href="#gallery">进入案例库</a>
            <a class="button subtle" :href="TOOL_URL">打开生图工具</a>
            <a class="button ghost" :href="REPO_URL" target="_blank" rel="noreferrer">
              查看原始仓库
            </a>
          </div>

          <div class="stats-grid">
            <article v-for="item in stats" :key="item.label" class="stat-card">
              <div class="stat-value">{{ item.value }}</div>
              <div class="stat-label">{{ item.label }}</div>
            </article>
          </div>
        </div>

        <div class="hero-visual" v-if="activeFeaturedCase">
          <div class="feature-frame" @click="openCase(activeFeaturedCase)">
            <img
              :src="getImageSrc(activeFeaturedCase)"
              :alt="activeFeaturedCase.title"
              loading="eager"
              @error="handleImageError($event, activeFeaturedCase)"
            />
            <div class="feature-overlay">
              <div class="feature-topline">
                <div class="feature-category">{{ activeFeaturedCase.category }}</div>
                <span class="source-pill inverse">{{ activeFeaturedCase.sourceLabel }}</span>
              </div>
              <h2>{{ activeFeaturedCase.title }}</h2>
              <p>{{ activeFeaturedCase.authorHandle }}</p>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section class="notice-strip">
          <div>
            <strong>站内已集成 GPT-Image-2 生图工具</strong>
            <div>支持输入 Prompt、上传参考图、复用历史记录，用户可以直接从案例库跳过去开始生成。</div>
          </div>
          <div class="notice-strip-actions">
            <a class="button primary" :href="TOOL_URL">立即去生图</a>
            <a class="button ghost" href="#gallery">继续浏览案例</a>
          </div>
        </section>

        <section class="control-panel" id="gallery">
          <div class="panel-head panel-head-wrap">
            <div>
              <div class="section-kicker">Cases Library</div>
              <h2>按分类、作者、来源与关键词快速筛选</h2>
            </div>
            <div class="panel-actions" v-if="editorAvailable">
              <button class="button subtle" type="button" @click="openCreateEditor()">
                新增案例
              </button>
              <button class="button subtle" type="button" @click="toggleEditMode">
                {{ isEditing ? '退出编辑' : '编辑模式' }}
              </button>
              <button class="button subtle" type="button" @click="exportCurrentJson">
                导出 JSON
              </button>
              <button class="button subtle" type="button" @click="openPreview">
                data.js 预览
              </button>
              <button class="button subtle" type="button" @click="exportCurrentDataJs">
                导出 data.js
              </button>
              <button class="button subtle" type="button" @click="openImportDialog">
                导入 JSON
              </button>
              <button class="button subtle danger" type="button" @click="resetLocalEdits" :disabled="!hasLocalEdits">
                清空本地编辑
              </button>
              <button class="button subtle" type="button" @click="resetFilters">
                重置筛选
              </button>
            </div>
          </div>

          <input
            v-if="editorAvailable"
            ref="importInput"
            class="hidden-file-input"
            type="file"
            accept=".json,application/json,.js,application/javascript"
            @change="handleImportFile"
          />
          <div v-if="editorNotice" class="editor-notice">{{ editorNotice }}</div>
          <div class="editor-hint">
            <template v-if="editorAvailable">
              当前是本地编辑模式：修改只保存在当前浏览器，不会直接改写磁盘文件。可导入 / 导出 JSON 或 data.js，再手动发布到网站。导入会替换当前本地数据。
            </template>
            <template v-else>
              当前是发布浏览模式：普通访问者只能查看内容，不会看到编辑入口。
            </template>
          </div>

          <div v-if="editorAvailable && backups.length" class="backup-panel">
            <div class="backup-head">
              <div>
                <div class="section-kicker">Local Backups</div>
                <h3>本地备份快照</h3>
              </div>
              <div class="backup-count">保留最近 {{ backups.length }} 份</div>
            </div>
            <div class="backup-list">
              <article v-for="backup in backups" :key="backup.id" class="backup-card">
                <div class="backup-card-top">
                  <strong>{{ backup.label }}</strong>
                  <span>{{ formatBackupTime(backup.createdAt) }}</span>
                </div>
                <div class="backup-card-meta">
                  {{ backup.sections.length }} 个分区 · {{ backup.sections.reduce((sum, section) => sum + (section.cases?.length || 0), 0) }} 条案例
                </div>
                <div class="backup-actions">
                  <button class="button subtle small" type="button" @click="restoreBackup(backup)">恢复</button>
                  <button class="button subtle small" type="button" @click="exportBackupJson(backup)">导出 JSON</button>
                  <button class="button subtle danger small" type="button" @click="deleteBackup(backup.id)">删除</button>
                </div>
              </article>
            </div>
          </div>

          <div class="search-row">
            <label class="search-box" for="case-search">
              <span>搜索</span>
              <input
                id="case-search"
                name="case-search"
                v-model="query"
                type="search"
                placeholder="标题 / 作者 / 提示词 / 标签 / 来源链接"
              />
            </label>
          </div>

          <div class="filter-group">
            <div class="filter-label">分类</div>
            <div class="chip-row">
              <button
                type="button"
                class="chip"
                :class="{ active: activeCategory === SECTION_ALL }"
                @click="setCategory(SECTION_ALL)"
              >
                {{ SECTION_ALL }}
              </button>
              <button
                v-for="section in sections"
                :key="section.id"
                type="button"
                class="chip"
                :class="{ active: activeCategory === section.title }"
                @click="setCategory(section.title)"
              >
                {{ section.title }}
                <span>{{ section.cases.length }}</span>
              </button>
            </div>
          </div>

          <div class="filter-group">
            <div class="filter-label">来源</div>
            <div class="chip-row">
              <button
                v-for="source in sourceOptions"
                :key="source.label"
                type="button"
                class="chip compact"
                :class="{ active: activeSource === source.label }"
                @click="setSource(source.label)"
              >
                {{ source.label }}
                <span>{{ source.total }}</span>
              </button>
            </div>
          </div>

          <div class="filter-group">
            <div class="filter-label">作者</div>
            <div class="chip-row author-row">
              <button
                v-for="author in authorOptions"
                :key="author.handle"
                type="button"
                class="chip compact"
                :class="{ active: activeAuthor === author.handle }"
                @click="setAuthor(author.handle)"
              >
                {{ author.handle }}
                <span>{{ author.total }}</span>
              </button>
            </div>
          </div>
        </section>

        <section v-if="loading" class="state-grid">
          <article v-for="index in 6" :key="index" class="skeleton-card"></article>
        </section>

        <section v-else-if="error" class="state-card">
          <h3>内容加载失败</h3>
          <p>{{ error }}</p>
          <p>请确认 index.html、app.js、data.js、styles.css、vendor/vue.global.prod.js 文件都在同一目录。</p>
        </section>

        <section v-else-if="!filteredCases.length" class="state-card">
          <h3>没有匹配结果</h3>
          <p>可以尝试清空关键词，或重新切换分类、来源与作者筛选。</p>
        </section>

        <section
          v-else
          v-for="section in filteredSections"
          :key="section.id"
          class="gallery-section"
        >
          <div class="section-head">
            <div>
              <div class="section-kicker">Gallery</div>
              <h2>{{ section.title }}</h2>
            </div>
            <div class="section-head-actions">
              <div class="section-count">{{ section.cases.length }} 个案例</div>
              <button v-if="editorAvailable && isEditing" class="button subtle small" type="button" @click="openCreateEditor(section.title)">
                在此分类新增
              </button>
            </div>
          </div>

          <div class="gallery-grid">
            <article v-for="item in section.cases" :key="item.id" class="case-card">
              <button type="button" class="case-media" @click="openCase(item)">
                <img
                  :src="getImageSrc(item)"
                  :alt="item.title"
                  loading="lazy"
                  @error="handleImageError($event, item)"
                />
                <div class="case-media-note">点击查看大图与完整提示词</div>
              </button>

              <div class="case-body">
                <div class="case-meta">
                  <span>{{ item.category }}</span>
                  <a :href="item.authorUrl" target="_blank" rel="noreferrer">
                    {{ item.authorHandle }}
                  </a>
                </div>

                <div class="case-badges">
                  <span class="source-pill">{{ item.sourceLabel }}</span>
                  <span v-if="item.imageCount > 1" class="meta-pill">{{ item.imageCount }} 张图</span>
                </div>

                <h3>{{ item.title }}</h3>
                <p class="case-excerpt">{{ item.promptExcerpt }}</p>

                <div class="case-actions">
                  <a class="text-link" :href="item.sourceUrl" target="_blank" rel="noreferrer">
                    查看原帖
                  </a>
                  <button class="text-link button-reset" type="button" @click="copyPrompt(item)">
                    {{ copiedCaseId === item.id ? '已复制提示词' : '复制提示词' }}
                  </button>
                  <button class="text-link button-reset" type="button" @click="openCase(item)">
                    查看详情
                  </button>
                  <button v-if="editorAvailable && isEditing" class="text-link button-reset" type="button" @click="openEditEditor(item)">
                    编辑
                  </button>
                  <button v-if="editorAvailable && isEditing" class="text-link button-reset danger-link" type="button" @click="deleteCase(item)">
                    删除
                  </button>
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>

      <footer class="site-footer">
        <div>整合来源：{{ libraryMeta.sourceCount || 4 }} 个数据源</div>
        <div>
          最近更新：{{ libraryMeta.dataVersion || '—' }} ·
          <a :href="REPO_URL" target="_blank" rel="noreferrer">{{ SOURCE_LABEL }}</a>
        </div>
      </footer>

      <teleport to="body">
        <transition name="fade">
          <div v-if="selectedCase" class="modal" @click.self="closeCase">
            <div class="modal-shell">
              <button type="button" class="modal-close" @click="closeCase">关闭</button>

              <div class="modal-media">
                <img
                  :src="getImageSrc(selectedCase)"
                  :alt="selectedCase.title"
                  @error="handleImageError($event, selectedCase)"
                />
              </div>

              <div class="modal-body">
                <div class="modal-kicker">{{ selectedCase.category }}</div>
                <h3>{{ selectedCase.title }}</h3>

                <div class="modal-links">
                  <a :href="selectedCase.authorUrl" target="_blank" rel="noreferrer">
                    {{ selectedCase.authorHandle }}
                  </a>
                  <a :href="selectedCase.sourceUrl" target="_blank" rel="noreferrer">
                    原始链接
                  </a>
                  <button v-if="editorAvailable && isEditing" class="button subtle small" type="button" @click="openEditEditor(selectedCase)">
                    编辑当前案例
                  </button>
                  <button v-if="editorAvailable && isEditing" class="button subtle danger small" type="button" @click="deleteCase(selectedCase)">
                    删除当前案例
                  </button>
                </div>

                <div class="modal-meta-grid">
                  <div class="meta-card">
                    <div class="meta-label">来源</div>
                    <div class="meta-value">{{ selectedCase.sourceName || selectedCase.sourceLabel }}</div>
                  </div>
                  <div class="meta-card">
                    <div class="meta-label">图片数量</div>
                    <div class="meta-value">{{ selectedCase.imageCount || 1 }}</div>
                  </div>
                </div>

                <div v-if="selectedCase.tags && selectedCase.tags.length" class="tag-list">
                  <span v-for="tag in selectedCase.tags" :key="tag" class="tag-chip">{{ tag }}</span>
                </div>

                <div class="prompt-panel">
                  <div class="prompt-head">
                    <span>提示词</span>
                    <div class="prompt-head-actions">
                      <button class="button subtle" type="button" @click="copyPrompt(selectedCase)">
                        {{ copiedCaseId === selectedCase.id ? '已复制' : '复制' }}
                      </button>
                    </div>
                  </div>
                  <pre>{{ selectedCase.prompt }}</pre>
                </div>

                <div class="modal-nav">
                  <button
                    type="button"
                    class="button ghost"
                    :disabled="!hasPreviousCase"
                    @click="moveCase(-1)"
                  >
                    上一个
                  </button>
                  <button
                    type="button"
                    class="button primary"
                    :disabled="!hasNextCase"
                    @click="moveCase(1)"
                  >
                    下一个
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </teleport>

      <teleport to="body">
        <transition name="fade">
          <div v-if="editorVisible" class="editor-modal" @click.self="closeEditor">
            <div class="editor-shell">
              <div class="editor-head">
                <div>
                  <div class="section-kicker">Web Editor</div>
                  <h3>{{ editorMode === 'edit' ? '编辑案例' : '新增案例' }}</h3>
                </div>
                <button class="button ghost small" type="button" @click="closeEditor">关闭</button>
              </div>

              <p class="editor-copy">
                所有编辑都保存在当前浏览器。改完可直接“导出 data.js”，再替换到项目里。
              </p>

              <div class="editor-grid">
                <label class="editor-field field-wide">
                  <span>标题</span>
                  <input v-model="editorForm.title" type="text" placeholder="案例标题" />
                </label>

                <label class="editor-field">
                  <span>分类</span>
                  <input v-model="editorForm.category" type="text" placeholder="可输入现有分类或新分类" />
                </label>

                <label class="editor-field">
                  <span>图片数量</span>
                  <input v-model="editorForm.imageCount" type="number" min="1" step="1" />
                </label>

                <label class="editor-field">
                  <span>作者</span>
                  <input v-model="editorForm.authorHandle" type="text" placeholder="@author" />
                </label>

                <label class="editor-field">
                  <span>作者链接</span>
                  <input v-model="editorForm.authorUrl" type="url" placeholder="https://x.com/..." />
                </label>

                <label class="editor-field">
                  <span>来源类型</span>
                  <select v-model="editorForm.sourceKey" @change="applySourcePreset(editorForm.sourceKey)">
                    <option v-for="source in editorSourceOptions" :key="source.key" :value="source.key">
                      {{ source.label }}
                    </option>
                  </select>
                </label>

                <label class="editor-field">
                  <span>来源标签</span>
                  <input v-model="editorForm.sourceLabel" type="text" placeholder="例如：GitHub 原始" />
                </label>

                <label class="editor-field">
                  <span>来源名称</span>
                  <input v-model="editorForm.sourceName" type="text" placeholder="例如：awesome-gpt-image-2-prompts 原始补充" />
                </label>

                <label class="editor-field field-wide">
                  <span>来源链接</span>
                  <input v-model="editorForm.sourceUrl" type="url" placeholder="帖子 / 页面原链接" />
                </label>

                <label class="editor-field field-wide">
                  <span>主图片 URL</span>
                  <input v-model="editorForm.imageUrl" type="url" placeholder="https://..." />
                </label>

                <label class="editor-field field-wide">
                  <span>备用图片 URL</span>
                  <input v-model="editorForm.fallbackImageUrl" type="url" placeholder="主图失效时使用" />
                </label>

                <label class="editor-field field-wide">
                  <span>标签</span>
                  <input v-model="editorForm.tagsText" type="text" placeholder="用逗号分隔，如：UI, 海报, 角色设定" />
                </label>

                <label class="editor-field field-wide">
                  <span>提示词</span>
                  <textarea v-model="editorForm.prompt" rows="12" placeholder="完整提示词"></textarea>
                </label>
              </div>

              <div class="editor-actions">
                <button
                  v-if="editorMode === 'edit'"
                  class="button subtle danger"
                  type="button"
                  @click="deleteCurrentEditorCase"
                >
                  删除
                </button>
                <div class="editor-actions-right">
                  <button class="button ghost" type="button" @click="closeEditor">取消</button>
                  <button class="button primary" type="button" @click="saveEditor">保存修改</button>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </teleport>

      <teleport to="body">
        <transition name="fade">
          <div v-if="previewVisible" class="editor-modal" @click.self="closePreview">
            <div class="editor-shell preview-shell">
              <div class="editor-head">
                <div>
                  <div class="section-kicker">Publish Preview</div>
                  <h3>可替换的 data.js 预览</h3>
                </div>
                <button class="button ghost small" type="button" @click="closePreview">关闭</button>
              </div>

              <p class="editor-copy">
                这是当前浏览器内编辑结果生成的完整 <code>data.js</code>。发布前可先在这里检查，再复制或下载替换项目文件。
              </p>

              <div class="preview-actions">
                <button class="button subtle" type="button" @click="copyDataJsPreview">复制预览</button>
                <button class="button primary" type="button" @click="downloadDataJsPreview">下载 data.js</button>
              </div>

              <label class="editor-field field-wide preview-field">
                <span>当前 data.js</span>
                <textarea :value="dataJsPreview" readonly rows="18"></textarea>
              </label>
            </div>
          </div>
        </transition>
      </teleport>
    </div>
  `,
}).mount('#app');
