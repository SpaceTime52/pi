# 비주얼 컴패니언 가이드

목업, 다이어그램, 선택지를 보여주기 위한 브라우저 기반 시각 브레인스토밍 컴패니언입니다.

## 언제 사용할까

세션 단위가 아니라 질문 단위로 판단합니다. 기준은 이것입니다: **읽는 것보다 보는 편이 사용자의 이해에 더 도움이 되는가?**

**콘텐츠 자체가 시각적이라면 브라우저를 사용**합니다:

- **UI 목업** — 와이어프레임, 레이아웃, 내비게이션 구조, 컴포넌트 디자인
- **아키텍처 다이어그램** — 시스템 구성요소, 데이터 흐름, 관계도
- **나란히 보는 시각 비교** — 두 레이아웃, 두 색상 체계, 두 디자인 방향 비교
- **디자인 디테일 검토** — 분위기, 간격, 시각적 위계가 핵심인 질문
- **공간적 관계** — 상태 머신, 플로우차트, 다이어그램으로 표현한 엔터티 관계

**콘텐츠가 텍스트나 표 중심이라면 터미널을 사용**합니다:

- **요구사항과 범위 관련 질문** — "X는 무슨 뜻인가요?", "어떤 기능이 범위에 포함되나요?"
- **개념적 A/B/C 선택** — 글로 설명할 수 있는 접근 방식 사이의 선택
- **트레이드오프 목록** — 장단점, 비교표
- **기술적 의사결정** — API 설계, 데이터 모델링, 아키텍처 접근 방식 선택
- **명확화 질문** — 답이 시각적 선호가 아니라 말로 설명되는 모든 경우

UI에 관한 질문이라고 해서 자동으로 시각적 질문이 되는 것은 아닙니다. "어떤 종류의 위저드를 원하나요?"는 개념적 질문이므로 터미널을 사용합니다. "이 위저드 레이아웃들 중 어떤 것이 더 적절한가요?"는 시각적 질문이므로 브라우저를 사용합니다.

## 동작 방식

서버는 HTML 파일이 있는 디렉터리를 감시하고, 가장 최신 파일을 브라우저에 제공합니다. 여러분이 `screen_dir`에 HTML 콘텐츠를 쓰면 사용자는 브라우저에서 이를 보고 옵션을 클릭해 선택할 수 있습니다. 선택 결과는 `state_dir/events`에 기록되며, 다음 턴에 이를 읽으면 됩니다.

**콘텐츠 조각 vs 전체 문서:** HTML 파일이 `<!DOCTYPE` 또는 `<html`로 시작하면 서버는 그 문서를 그대로 제공합니다(헬퍼 스크립트만 주입). 그렇지 않으면 서버가 콘텐츠를 프레임 템플릿으로 자동 감쌉니다. 즉, 헤더, CSS 테마, 선택 표시기, 상호작용 인프라가 추가됩니다. **기본적으로는 콘텐츠 조각을 작성하세요.** 페이지를 완전히 제어해야 할 때만 전체 문서를 작성합니다.

## 세션 시작하기

```bash
# Start server with persistence (mockups saved to project)
scripts/start-server.sh --project-dir /path/to/project

# Returns: {"type":"server-started","port":52341,"url":"http://localhost:52341",
#           "screen_dir":"/path/to/project/.pi/brainstorm/12345-1706000000/content",
#           "state_dir":"/path/to/project/.pi/brainstorm/12345-1706000000/state"}
```

응답에서 `screen_dir`와 `state_dir`를 저장하세요. 그리고 사용자에게 URL을 열어 달라고 안내합니다.

**연결 정보 찾기:** 서버는 시작 시 생성한 JSON을 `$STATE_DIR/server-info`에 기록합니다. 서버를 백그라운드에서 띄우면서 stdout을 저장하지 못했다면 이 파일을 읽어 URL과 포트를 확인하세요. `--project-dir`를 사용했다면 세션 디렉터리는 `<project>/.pi/brainstorm/` 아래에 있습니다.

**참고:** 목업이 `.pi/brainstorm/` 아래에 유지되고 서버를 재시작해도 남아 있도록 프로젝트 루트를 `--project-dir`로 넘기세요. 이를 지정하지 않으면 파일은 `/tmp`에 생성되고 정리됩니다. 아직 `.pi/`가 `.gitignore`에 없다면 추가하라고 사용자에게 알려주세요.

**서버 실행:**

```bash
# Default mode works — the script backgrounds the server itself
scripts/start-server.sh --project-dir /path/to/project
```

브라우저에서 URL에 접속할 수 없다면(원격/컨테이너 환경에서 흔함), 루프백이 아닌 호스트에 바인딩하세요:

```bash
scripts/start-server.sh \
  --project-dir /path/to/project \
  --host 0.0.0.0 \
  --url-host localhost
```

반환되는 URL JSON에 어떤 호스트명이 찍힐지 제어하려면 `--url-host`를 사용하세요.

**기타 환경:** 서버는 대화 턴이 바뀌어도 백그라운드에서 계속 실행되어야 합니다. 실행 환경이 분리된 프로세스를 수거한다면 `--foreground`를 사용하고, 해당 플랫폼의 백그라운드 실행 메커니즘으로 명령을 실행하세요.

## 진행 루프

1. **서버가 살아 있는지 확인**한 다음, `screen_dir`에 새 파일로 **HTML을 작성**합니다:
   - 매번 쓰기 전에 `$STATE_DIR/server-info`가 존재하는지 확인합니다. 없거나 `$STATE_DIR/server-stopped`가 있다면 서버가 종료된 것이므로 계속하기 전에 `start-server.sh`로 다시 시작하세요. 서버는 30분 동안 활동이 없으면 자동 종료됩니다.
   - 의미가 드러나는 파일명을 사용합니다: `platform.html`, `visual-style.html`, `layout.html`
   - **파일명을 절대 재사용하지 마세요** — 각 화면은 새 파일이어야 합니다
   - Write 도구를 사용하세요 — **cat/heredoc은 절대 사용하지 마세요** (터미널에 불필요한 출력이 쏟아집니다)
   - 서버는 가장 최신 파일을 자동으로 제공합니다

2. **사용자에게 무엇을 보게 될지 설명하고 턴을 마칩니다:**
   - URL을 매 단계마다 다시 알려줍니다(첫 단계만이 아니라 매번)
   - 화면에 무엇이 있는지 짧게 요약합니다(예: "홈페이지용 레이아웃 3가지를 보여주고 있습니다")
   - 터미널로 답해 달라고 요청합니다: "한번 보시고 어떤 느낌인지 알려주세요. 원하시면 옵션을 클릭해 선택하셔도 됩니다."

3. **다음 턴에서** — 사용자가 터미널로 응답한 뒤:
   - `$STATE_DIR/events`가 있으면 읽습니다 — 사용자의 브라우저 상호작용(클릭, 선택)이 JSON Lines 형식으로 들어 있습니다
   - 이를 사용자의 터미널 텍스트와 합쳐 전체 맥락을 파악합니다
   - 터미널 메시지가 주된 피드백이며, `state_dir/events`는 구조화된 상호작용 데이터를 보완적으로 제공합니다

4. **반복하거나 다음 단계로 진행**합니다 — 피드백 때문에 현재 화면을 바꿔야 한다면 새 파일을 씁니다(예: `layout-v2.html`). 현재 단계가 검증되기 전에는 다음 질문으로 넘어가지 않습니다.

5. **터미널로 돌아갈 때는 비우기 화면을 보냅니다** — 다음 단계에 브라우저가 필요 없다면(예: 명확화 질문, 트레이드오프 논의), 오래된 화면이 남아 있지 않도록 대기 화면을 띄웁니다:

   ```html
   <!-- filename: waiting.html (or waiting-2.html, etc.) -->
   <div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
     <p class="subtitle">Continuing in terminal...</p>
   </div>
   ```

   이렇게 하면 대화는 다음으로 넘어갔는데 사용자가 이미 결론 난 선택지를 계속 보고 있는 상황을 막을 수 있습니다. 다음에 시각적 질문이 나오면 평소처럼 새 콘텐츠 파일을 올리면 됩니다.

6. 완료될 때까지 반복합니다.

## 콘텐츠 조각 작성하기

페이지 안에 들어갈 콘텐츠만 작성하세요. 서버가 이를 프레임 템플릿으로 자동 감싸며(헤더, 테마 CSS, 선택 표시기, 상호작용 인프라 포함), 나머지는 알아서 처리합니다.

**최소 예시:**

```html
<h2>Which layout works better?</h2>
<p class="subtitle">Consider readability and visual hierarchy</p>

<div class="options">
  <div class="option" data-choice="a" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content">
      <h3>Single Column</h3>
      <p>Clean, focused reading experience</p>
    </div>
  </div>
  <div class="option" data-choice="b" onclick="toggleSelect(this)">
    <div class="letter">B</div>
    <div class="content">
      <h3>Two Column</h3>
      <p>Sidebar navigation with main content</p>
    </div>
  </div>
</div>
```

이것만 있으면 됩니다. `<html>`도, CSS도, `<script>` 태그도 필요 없습니다. 서버가 모두 제공합니다.

## 사용할 수 있는 CSS 클래스

프레임 템플릿은 콘텐츠 작성에 사용할 수 있는 다음 CSS 클래스를 제공합니다.

### 옵션(A/B/C 선택)

```html
<div class="options">
  <div class="option" data-choice="a" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content">
      <h3>Title</h3>
      <p>Description</p>
    </div>
  </div>
</div>
```

**다중 선택:** 컨테이너에 `data-multiselect`를 추가하면 여러 옵션을 선택할 수 있습니다. 클릭할 때마다 해당 항목이 토글되며, 표시 바에는 선택 개수가 나타납니다.

```html
<div class="options" data-multiselect>
  <!-- same option markup — users can select/deselect multiple -->
</div>
```

### 카드(시각 디자인)

```html
<div class="cards">
  <div class="card" data-choice="design1" onclick="toggleSelect(this)">
    <div class="card-image"><!-- mockup content --></div>
    <div class="card-body">
      <h3>Name</h3>
      <p>Description</p>
    </div>
  </div>
</div>
```

### 목업 컨테이너

```html
<div class="mockup">
  <div class="mockup-header">Preview: Dashboard Layout</div>
  <div class="mockup-body"><!-- your mockup HTML --></div>
</div>
```

### 분할 뷰(나란히 보기)

```html
<div class="split">
  <div class="mockup"><!-- left --></div>
  <div class="mockup"><!-- right --></div>
</div>
```

### 장점/단점

```html
<div class="pros-cons">
  <div class="pros"><h4>Pros</h4><ul><li>Benefit</li></ul></div>
  <div class="cons"><h4>Cons</h4><ul><li>Drawback</li></ul></div>
</div>
```

### 목업 요소(와이어프레임 빌딩 블록)

```html
<div class="mock-nav">Logo | Home | About | Contact</div>
<div style="display: flex;">
  <div class="mock-sidebar">Navigation</div>
  <div class="mock-content">Main content area</div>
</div>
<button class="mock-button">Action Button</button>
<input class="mock-input" placeholder="Input field">
<div class="placeholder">Placeholder area</div>
```

### 타이포그래피와 섹션

- `h2` — 페이지 제목
- `h3` — 섹션 제목
- `.subtitle` — 제목 아래의 보조 텍스트
- `.section` — 아래쪽 여백이 있는 콘텐츠 블록
- `.label` — 작은 대문자 라벨 텍스트

## 브라우저 이벤트 형식

사용자가 브라우저에서 옵션을 클릭하면 상호작용이 `$STATE_DIR/events`에 기록됩니다(한 줄당 JSON 객체 하나). 새 화면을 올리면 이 파일은 자동으로 비워집니다.

```jsonl
{"type":"click","choice":"a","text":"Option A - Simple Layout","timestamp":1706000101}
{"type":"click","choice":"c","text":"Option C - Complex Grid","timestamp":1706000108}
{"type":"click","choice":"b","text":"Option B - Hybrid","timestamp":1706000115}
```

전체 이벤트 흐름을 보면 사용자가 어떤 경로로 탐색했는지 알 수 있습니다. 최종 선택 전에 여러 옵션을 눌러볼 수 있으며, 마지막 `choice` 이벤트가 보통 최종 선택이지만, 클릭 패턴 자체가 망설임이나 선호를 드러낼 수 있으므로 추가 질문의 단서가 될 수 있습니다.

`$STATE_DIR/events`가 없다면 사용자가 브라우저와 상호작용하지 않은 것이므로, 터미널 텍스트만 사용하면 됩니다.

## 디자인 팁

- **질문의 성격에 맞는 정밀도로 표현하세요** — 레이아웃 질문에는 와이어프레임, 디테일 질문에는 더 정교한 시안
- **매 페이지에서 무엇을 묻는지 설명하세요** — "하나를 고르세요"보다 "어떤 레이아웃이 더 전문적으로 느껴지나요?"가 낫습니다
- **다음 단계로 넘어가기 전에 반복하세요** — 피드백이 현재 화면을 바꾸면 새 버전을 작성합니다
- 한 화면에는 **최대 2~4개 옵션**만 두세요
- **중요하다면 실제 콘텐츠를 사용하세요** — 예를 들어 사진 포트폴리오라면 실제 이미지(Unsplash)를 넣으세요. 플레이스홀더는 디자인 문제를 가립니다.
- **목업은 단순하게 유지하세요** — 픽셀 단위 완성도보다 레이아웃과 구조에 집중합니다

## 파일 이름 규칙

- 의미가 드러나는 이름을 사용합니다: `platform.html`, `visual-style.html`, `layout.html`
- 파일명을 재사용하지 마세요 — 각 화면은 반드시 새 파일이어야 합니다
- 반복본은 `layout-v2.html`, `layout-v3.html`처럼 버전 접미사를 붙입니다
- 서버는 수정 시각 기준으로 가장 최신 파일을 제공합니다

## 정리하기

```bash
scripts/stop-server.sh $SESSION_DIR
```

세션이 `--project-dir`를 사용했다면 목업 파일은 나중에 참고할 수 있도록 `.pi/brainstorm/` 아래에 남습니다. 중지 시 삭제되는 것은 `/tmp` 세션뿐입니다.

## 참고 자료

- 프레임 템플릿(CSS 참고): `scripts/frame-template.html`
- 헬퍼 스크립트(클라이언트 측): `scripts/helper.js`
