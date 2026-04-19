const { computed, createApp, onBeforeUnmount, onMounted, ref, watch } = Vue;

const REPO_URL = "https://github.com/EvoLinkAI/awesome-gpt-image-2-prompts";
const SOURCE_LABEL = "awesome-gpt-image-2-prompts";
const AUTHOR_ALL = "全部作者";
const SECTION_ALL = "全部分类";

createApp({
  setup() {
    const loading = ref(false);
    const error = ref("");
    const sections = ref(Array.isArray(window.CASE_LIBRARY) ? window.CASE_LIBRARY : []);
    const query = ref("");
    const activeCategory = ref(SECTION_ALL);
    const activeAuthor = ref(AUTHOR_ALL);
    const selectedCase = ref(null);
    const copiedCaseId = ref("");
    const featuredIndex = ref(0);

    if (!sections.value.length) {
      error.value = "本地案例数据未加载成功，请确认 data.js 与 index.html 在同一目录下。";
    }

    const allCases = computed(() =>
      sections.value.flatMap((section) => section.cases),
    );

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

    const filteredSections = computed(() => {
      const normalizedQuery = query.value.trim().toLowerCase();

      return sections.value
        .map((section) => {
          const cases = section.cases.filter((item) => {
            const matchesCategory =
              activeCategory.value === SECTION_ALL ||
              item.category === activeCategory.value;
            const matchesAuthor =
              activeAuthor.value === AUTHOR_ALL ||
              item.authorHandle === activeAuthor.value;
            const matchesQuery =
              !normalizedQuery || item.searchIndex.includes(normalizedQuery);

            return matchesCategory && matchesAuthor && matchesQuery;
          });

          return {
            ...section,
            cases,
          };
        })
        .filter((section) => section.cases.length > 0);
    });

    const filteredCases = computed(() =>
      filteredSections.value.flatMap((section) => section.cases),
    );

    const featuredCases = computed(() => allCases.value.slice(0, 6));
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
        label: "公开案例",
        value: allCases.value.length || "--",
      },
      {
        label: "分类维度",
        value: sections.value.length || "--",
      },
      {
        label: "创作者",
        value: totalAuthors.value || "--",
      },
      {
        label: "数据版本",
        value: "2026.04.18",
      },
    ]);

    const selectedCaseIndex = computed(() =>
      selectedCase.value
        ? filteredCases.value.findIndex((item) => item.id === selectedCase.value.id)
        : -1,
    );

    const hasPreviousCase = computed(() => selectedCaseIndex.value > 0);
    const hasNextCase = computed(
      () =>
        selectedCaseIndex.value >= 0 &&
        selectedCaseIndex.value < filteredCases.value.length - 1,
    );

    async function copyPrompt(item) {
      try {
        await navigator.clipboard.writeText(item.prompt);
        copiedCaseId.value = item.id;
        window.setTimeout(() => {
          if (copiedCaseId.value === item.id) {
            copiedCaseId.value = "";
          }
        }, 1800);
      } catch {
        copiedCaseId.value = "";
      }
    }

    function openCase(item) {
      selectedCase.value = item;
      document.body.classList.add("modal-open");
    }

    function closeCase() {
      selectedCase.value = null;
      document.body.classList.remove("modal-open");
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

    function resetFilters() {
      query.value = "";
      activeCategory.value = SECTION_ALL;
      activeAuthor.value = AUTHOR_ALL;
    }

    function cycleFeatured() {
      if (featuredCases.value.length <= 1) {
        return;
      }

      featuredIndex.value =
        (featuredIndex.value + 1) % featuredCases.value.length;
    }

    function handleKeydown(event) {
      if (!selectedCase.value) {
        return;
      }

      if (event.key === "Escape") {
        closeCase();
      }

      if (event.key === "ArrowRight") {
        moveCase(1);
      }

      if (event.key === "ArrowLeft") {
        moveCase(-1);
      }
    }

    function handleImageError(event, item) {
      const currentTarget = event.target;

      if (
        currentTarget.dataset.fallbackApplied === "1" ||
        !item?.fallbackImageUrl ||
        currentTarget.src === item.fallbackImageUrl
      ) {
        return;
      }

      currentTarget.dataset.fallbackApplied = "1";
      currentTarget.src = item.fallbackImageUrl;
    }

    let featuredTimer = 0;

    onMounted(() => {
      window.addEventListener("keydown", handleKeydown);
      featuredTimer = window.setInterval(cycleFeatured, 5200);
    });

    onBeforeUnmount(() => {
      window.removeEventListener("keydown", handleKeydown);
      window.clearInterval(featuredTimer);
      document.body.classList.remove("modal-open");
    });

    watch([activeCategory, activeAuthor, query], () => {
      if (selectedCase.value) {
        const exists = filteredCases.value.some(
          (item) => item.id === selectedCase.value.id,
        );

        if (!exists) {
          selectedCase.value = null;
          document.body.classList.remove("modal-open");
        }
      }
    });

    return {
      SOURCE_LABEL,
      REPO_URL,
      AUTHOR_ALL,
      SECTION_ALL,
      loading,
      error,
      sections,
      stats,
      query,
      activeCategory,
      activeAuthor,
      authorOptions,
      filteredSections,
      filteredCases,
      selectedCase,
      copiedCaseId,
      activeFeaturedCase,
      hasPreviousCase,
      hasNextCase,
      copyPrompt,
      openCase,
      closeCase,
      moveCase,
      setCategory,
      setAuthor,
      resetFilters,
      handleImageError,
    };
  },
  template: `
    <div class="page-shell">
      <div class="ambient ambient-a"></div>
      <div class="ambient ambient-b"></div>

      <header class="hero">
        <div class="hero-copy">
          <div class="eyebrow">Curated Visual Prompt Library</div>
          <h1>
            <span class="hero-title-line">GPT-Image-2</span>
            <span class="hero-title-line">案例观摩馆</span>
          </h1>
          <p class="hero-text">
            这是一个基于
            <a :href="REPO_URL" target="_blank" rel="noreferrer">{{ SOURCE_LABEL }}</a>
            的公开案例整合页面，集中展示参考图、作者与提示词，帮助用户观摩并延展自己的创作。
          </p>

          <div class="hero-actions">
            <a class="button primary" :href="REPO_URL" target="_blank" rel="noreferrer">
              查看开源项目
            </a>
            <a class="button ghost" href="#gallery">
              进入案例库
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
              :src="activeFeaturedCase.imageUrl"
              :alt="activeFeaturedCase.title"
              loading="eager"
              @error="handleImageError($event, activeFeaturedCase)"
            />
            <div class="feature-overlay">
              <div class="feature-category">{{ activeFeaturedCase.category }}</div>
              <h2>{{ activeFeaturedCase.title }}</h2>
              <p>{{ activeFeaturedCase.authorHandle }}</p>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section class="control-panel" id="gallery">
          <div class="panel-head">
            <div>
              <div class="section-kicker">Cases Library</div>
              <h2>按分类、作者与关键词快速浏览</h2>
            </div>
            <button class="button subtle" type="button" @click="resetFilters">
              重置筛选
            </button>
          </div>

          <div class="search-row">
            <label class="search-box" for="case-search">
              <span>搜索</span>
              <input
                id="case-search"
                name="case-search"
                v-model="query"
                type="search"
                placeholder="标题 / 作者 / 提示词 / 来源链接"
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
          <p>请确认 [index.html, app.js, data.js, styles.css, vendor/vue.global.prod.js] 文件都在完整目录内。</p>
        </section>

        <section v-else-if="!filteredCases.length" class="state-card">
          <h3>没有匹配结果</h3>
          <p>可以尝试清空关键词，或者切换分类与作者筛选。</p>
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
            <div class="section-count">{{ section.cases.length }} 个案例</div>
          </div>

          <div class="gallery-grid">
            <article
              v-for="item in section.cases"
              :key="item.id"
              class="case-card"
            >
              <button type="button" class="case-media" @click="openCase(item)">
                <img
                  :src="item.imageUrl"
                  :alt="item.title"
                  loading="lazy"
                  @error="handleImageError($event, item)"
                />
                <div class="case-media-note">点击放大参考图</div>
              </button>

              <div class="case-body">
                <div class="case-meta">
                  <span>{{ item.category }}</span>
                  <a :href="item.authorUrl" target="_blank" rel="noreferrer">
                    {{ item.authorHandle }}
                  </a>
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
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>

      <footer class="site-footer">
        <div>信息来源：<a :href="REPO_URL" target="_blank" rel="noreferrer">{{ SOURCE_LABEL }}</a></div>
      </footer>

      <teleport to="body">
        <transition name="fade">
          <div v-if="selectedCase" class="modal" @click.self="closeCase">
            <div class="modal-shell">
              <button type="button" class="modal-close" @click="closeCase">关闭</button>

              <div class="modal-media">
                <img
                  :src="selectedCase.imageUrl"
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
                    原始分享
                  </a>
                </div>

                <div class="prompt-panel">
                  <div class="prompt-head">
                    <span>提示词</span>
                    <button class="button subtle" type="button" @click="copyPrompt(selectedCase)">
                      {{ copiedCaseId === selectedCase.id ? '已复制' : '复制' }}
                    </button>
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
    </div>
  `,
}).mount("#app");
