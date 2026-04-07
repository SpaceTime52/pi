# 스킬 작성 모범 사례

> pi가 스킬을 잘 발견하고 성공적으로 사용할 수 있도록, 효과적인 스킬을 작성하는 방법을 배운다.

좋은 스킬은 간결하고, 구조가 잘 잡혀 있으며, 실제 사용으로 검증되어야 한다. 이 가이드는 pi가 스킬을 잘 발견하고 효과적으로 사용할 수 있도록 돕는 실용적인 작성 원칙을 제공한다.

스킬이 어떻게 동작하는지에 대한 개념적 배경은 [Skills overview](/en/docs/agents-and-tools/agent-skills/overview)를 참고한다.

## 핵심 원칙

### 간결함이 핵심이다

[context window](https://platform.claude.com/docs/en/build-with-claude/context-windows)는 모두가 함께 쓰는 공공 자원이다. 당신의 스킬은 pi가 알아야 하는 다른 모든 정보와 함께 같은 컨텍스트 윈도를 공유한다. 여기에는 다음이 포함된다.

* 시스템 프롬프트
* 대화 기록
* 다른 스킬의 메타데이터
* 실제 요청 내용

스킬의 모든 토큰이 즉시 비용을 발생시키는 것은 아니다. 시작 시점에는 모든 스킬의 메타데이터(name과 description)만 미리 로드된다. pi는 스킬이 관련 있을 때만 SKILL.md를 읽고, 추가 파일도 필요할 때만 읽는다. 하지만 SKILL.md 역시 간결해야 한다. 일단 로드되면, 그 안의 모든 토큰은 대화 기록과 다른 컨텍스트와 경쟁하게 된다.

**기본 전제**: pi는 이미 매우 똑똑하다

pi가 이미 알고 있을 내용을 굳이 넣지 말고, 정말 필요한 맥락만 추가한다. 각 정보마다 다음을 자문해 보라.

* "pi가 이 설명을 정말로 필요로 하는가?"
* "이건 pi가 이미 안다고 가정해도 되는가?"
* "이 문단은 토큰 비용을 감수할 만큼 가치가 있는가?"

**좋은 예시: 간결함** (약 50토큰):

````markdown  theme={null}
## Extract PDF text

Use pdfplumber for text extraction:

```python
import pdfplumber

with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```
````

**나쁜 예시: 지나치게 장황함** (약 150토큰):

```markdown  theme={null}
## Extract PDF text

PDF (Portable Document Format) files are a common file format that contains
text, images, and other content. To extract text from a PDF, you'll need to
use a library. There are many libraries available for PDF processing, but we
recommend pdfplumber because it's easy to use and handles most cases well.
First, you'll need to install it using pip. Then you can use the code below...
```

간결한 버전은 pi가 PDF가 무엇인지, 라이브러리가 어떻게 동작하는지 이미 안다고 가정한다.

### 적절한 자유도를 설정하라

작업의 취약성이나 변동성에 맞춰 구체성의 수준을 조절한다.

**자유도가 높을 때** (텍스트 기반 지침):

다음과 같은 경우에 사용한다.

* 여러 접근법이 모두 타당할 수 있을 때
* 결정이 맥락에 따라 달라질 때
* 휴리스틱이 접근 방식을 이끌 때

예시:

```markdown  theme={null}
## Code review process

1. Analyze the code structure and organization
2. Check for potential bugs or edge cases
3. Suggest improvements for readability and maintainability
4. Verify adherence to project conventions
```

**자유도가 중간일 때** (의사코드 또는 매개변수가 있는 스크립트):

다음과 같은 경우에 사용한다.

* 선호되는 패턴이 존재할 때
* 어느 정도의 변형은 허용될 때
* 설정값이 동작에 영향을 줄 때

예시:

````markdown  theme={null}
## Generate report

Use this template and customize as needed:

```python
def generate_report(data, format="markdown", include_charts=True):
    # Process data
    # Generate output in specified format
    # Optionally include visualizations
```
````

**자유도가 낮을 때** (구체적인 스크립트, 매개변수가 거의 없거나 전혀 없음):

다음과 같은 경우에 사용한다.

* 작업이 취약하고 실수하기 쉬울 때
* 일관성이 매우 중요할 때
* 반드시 특정 순서를 따라야 할 때

예시:

````markdown  theme={null}
## Database migration

Run exactly this script:

```bash
python scripts/migrate.py --verify --backup
```

Do not modify the command or add additional flags.
````

**비유**: pi를 길을 탐색하는 로봇이라고 생각해 보자.

* **양옆이 절벽인 좁은 다리**: 안전한 길이 사실상 하나뿐이다. 구체적인 가드레일과 정확한 지침을 제공해야 한다(낮은 자유도). 예: 정확한 순서대로 실행해야 하는 데이터베이스 마이그레이션.
* **위험 요소가 없는 넓은 들판**: 성공으로 가는 길이 여러 개다. 대략적인 방향만 주고, pi가 최적의 경로를 찾도록 맡긴다(높은 자유도). 예: 맥락에 따라 최선의 접근이 달라지는 코드 리뷰.

### 사용할 모든 모델로 테스트하라

스킬은 모델 위에 덧붙는 확장처럼 동작하므로, 실제 효과는 기반 모델에 따라 달라진다. 따라서 사용할 계획이 있는 모든 모델에서 스킬을 테스트해야 한다.

**모델별 테스트 관점**:

* **Claude Haiku** (빠르고 경제적): 스킬이 충분한 가이드를 제공하는가?
* **Claude Sonnet** (균형형): 스킬이 명확하고 효율적인가?
* **Claude Opus** (강력한 추론): 스킬이 과하게 설명하지는 않는가?

Opus에서는 완벽하게 작동하는 내용도 Haiku에는 더 자세한 설명이 필요할 수 있다. 여러 모델에서 스킬을 쓸 계획이라면, 모두에게 잘 통하는 지침을 목표로 하라.

## 스킬 구조

<Note>
  **YAML 프런트매터**: SKILL.md의 프런트매터에는 두 필드가 필요하다.

  * `name` - 사람이 읽을 수 있는 스킬 이름(최대 64자)
  * `description` - 스킬이 무엇을 하고 언제 사용해야 하는지를 한 줄로 설명(최대 1024자)

  스킬 구조 전체에 대한 자세한 내용은 [Skills overview](/en/docs/agents-and-tools/agent-skills/overview#skill-structure)를 참고한다.
</Note>

### 이름 규칙

일관된 이름 패턴을 사용하면 스킬을 더 쉽게 참조하고 논의할 수 있다. 권장 방식은 **동명사형**(동사 + -ing) 이름이다. 이렇게 하면 스킬이 제공하는 활동이나 기능이 더 분명하게 드러난다.

**좋은 이름 예시 (동명사형)**:

* "Processing PDFs"
* "Analyzing spreadsheets"
* "Managing databases"
* "Testing code"
* "Writing documentation"

**허용 가능한 대안**:

* 명사구: "PDF Processing", "Spreadsheet Analysis"
* 행동 중심 표현: "Process PDFs", "Analyze Spreadsheets"

**피해야 할 것**:

* 모호한 이름: "Helper", "Utils", "Tools"
* 지나치게 일반적인 이름: "Documents", "Data", "Files"
* 하나의 스킬 모음 안에서 뒤섞인 불일치한 이름 패턴

일관된 이름을 쓰면 다음이 쉬워진다.

* 문서와 대화에서 스킬을 참조하기
* 스킬이 무엇을 하는지 한눈에 이해하기
* 여러 스킬을 정리하고 검색하기
* 전문적이고 통일감 있는 스킬 라이브러리를 유지하기

### 효과적인 description 작성하기

`description` 필드는 스킬 발견을 가능하게 하므로, 스킬이 무엇을 하고 언제 사용해야 하는지를 모두 담아야 한다.

<Warning>
  **항상 3인칭으로 작성하라**. description은 시스템 프롬프트에 주입되기 때문에, 시점이 일관되지 않으면 스킬 발견에 문제가 생길 수 있다.

  * **좋음:** "Processes Excel files and generates reports"
  * **피할 것:** "I can help you process Excel files"
  * **피할 것:** "You can use this to process Excel files"
</Warning>

**구체적으로 쓰고 핵심 용어를 포함하라.** 스킬이 무엇을 하는지와, 언제 사용해야 하는지를 알려주는 구체적인 트리거/맥락을 함께 넣어야 한다.

각 스킬에는 description 필드가 정확히 하나만 있다. 이 필드는 스킬 선택에서 매우 중요하다. pi는 100개가 넘는 스킬 중에서 올바른 것을 고를 때 이 description을 사용한다. 따라서 description은 pi가 언제 이 스킬을 선택해야 하는지 알 수 있을 만큼 충분히 구체적이어야 하고, SKILL.md 나머지 부분은 구현 세부사항을 제공하는 구조여야 한다.

효과적인 예시:

**PDF Processing 스킬:**

```yaml  theme={null}
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
```

**Excel Analysis 스킬:**

```yaml  theme={null}
description: Analyze Excel spreadsheets, create pivot tables, generate charts. Use when analyzing Excel files, spreadsheets, tabular data, or .xlsx files.
```

**Git Commit Helper 스킬:**

```yaml  theme={null}
description: Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes.
```

다음처럼 모호한 description은 피하라.

```yaml  theme={null}
description: Helps with documents
```

```yaml  theme={null}
description: Processes data
```

```yaml  theme={null}
description: Does stuff with files
```

### 점진적 공개 패턴

SKILL.md는 필요할 때 상세 자료로 안내하는 개요 문서 역할을 한다. 온보딩 가이드의 목차처럼 생각하면 된다. 점진적 공개가 어떻게 작동하는지에 대한 설명은 overview의 [How Skills work](/en/docs/agents-and-tools/agent-skills/overview#how-skills-work)를 참고한다.

**실무 가이드:**

* 최적 성능을 위해 SKILL.md 본문은 500줄 이하로 유지한다
* 이 한계에 가까워지면 내용을 별도 파일로 분리한다
* 아래 패턴을 사용해 지침, 코드, 리소스를 효과적으로 구성한다

#### 시각적 개요: 단순한 구조에서 복잡한 구조로

기본적인 스킬은 메타데이터와 지침만 담은 SKILL.md 파일 하나로 시작한다.

스킬이 커지면, pi가 필요할 때만 로드하는 추가 콘텐츠를 함께 묶어 둘 수 있다.

완전한 스킬 디렉터리 구조는 다음과 같을 수 있다.

```
pdf/
├── SKILL.md              # Main instructions (loaded when triggered)
├── FORMS.md              # Form-filling guide (loaded as needed)
├── reference.md          # API reference (loaded as needed)
├── examples.md           # Usage examples (loaded as needed)
└── scripts/
    ├── analyze_form.py   # Utility script (executed, not loaded)
    ├── fill_form.py      # Form filling script
    └── validate.py       # Validation script
```

#### 패턴 1: 참조 링크가 있는 상위 수준 가이드

````markdown  theme={null}
---
name: PDF Processing
description: Extracts text and tables from PDF files, fills forms, and merges documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
---

# PDF Processing

## Quick start

Extract text with pdfplumber:
```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

## Advanced features

**Form filling**: See [FORMS.md](FORMS.md) for complete guide
**API reference**: See [REFERENCE.md](REFERENCE.md) for all methods
**Examples**: See [EXAMPLES.md](EXAMPLES.md) for common patterns
````

pi는 필요할 때만 FORMS.md, REFERENCE.md, EXAMPLES.md를 로드한다.

#### 패턴 2: 도메인별 구성

여러 도메인을 다루는 스킬이라면, 관련 없는 컨텍스트를 불러오지 않도록 도메인별로 내용을 구성한다. 예를 들어 사용자가 매출 지표를 물을 때는 재무나 마케팅 데이터가 아니라 매출 관련 스키마만 읽으면 된다. 이렇게 하면 토큰 사용량을 줄이고 컨텍스트를 집중시킬 수 있다.

```
bigquery-skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── finance.md (revenue, billing metrics)
    ├── sales.md (opportunities, pipeline)
    ├── product.md (API usage, features)
    └── marketing.md (campaigns, attribution)
```

````markdown SKILL.md theme={null}
# BigQuery Data Analysis

## Available datasets

**Finance**: Revenue, ARR, billing -> See [reference/finance.md](reference/finance.md)
**Sales**: Opportunities, pipeline, accounts -> See [reference/sales.md](reference/sales.md)
**Product**: API usage, features, adoption -> See [reference/product.md](reference/product.md)
**Marketing**: Campaigns, attribution, email -> See [reference/marketing.md](reference/marketing.md)

## Quick search

Find specific metrics using grep:

```bash
grep -i "revenue" reference/finance.md
grep -i "pipeline" reference/sales.md
grep -i "api usage" reference/product.md
```
````

#### 패턴 3: 조건부 상세 정보

기본 내용은 보여주고, 고급 내용은 링크로 연결한다.

```markdown  theme={null}
# DOCX Processing

## Creating documents

Use docx-js for new documents. See [DOCX-JS.md](DOCX-JS.md).

## Editing documents

For simple edits, modify the XML directly.

**For tracked changes**: See [REDLINING.md](REDLINING.md)
**For OOXML details**: See [OOXML.md](OOXML.md)
```

이 경우 pi는 사용자가 해당 기능을 필요로 할 때만 REDLINING.md나 OOXML.md를 읽는다.

### 너무 깊게 중첩된 참조는 피하라

pi는 다른 참조 파일 안에서 다시 참조된 파일을 만났을 때, 전체 파일을 읽기보다 `head -100` 같은 명령으로 일부만 미리 보는 식으로 접근할 수 있다. 그러면 정보가 불완전해질 수 있다.

**참조는 SKILL.md에서 한 단계 깊이까지만 유지하라.** 모든 참조 파일은 SKILL.md에서 직접 링크되어야, 필요할 때 pi가 전체 파일을 읽을 가능성이 높아진다.

**나쁜 예시: 너무 깊음**:

```markdown  theme={null}
# SKILL.md
See [advanced.md](advanced.md)...

# advanced.md
See [details.md](details.md)...

# details.md
Here's the actual information...
```

**좋은 예시: 한 단계 깊이**:

```markdown  theme={null}
# SKILL.md

**Basic usage**: [instructions in SKILL.md]
**Advanced features**: See [advanced.md](advanced.md)
**API reference**: See [reference.md](reference.md)
**Examples**: See [examples.md](examples.md)
```

### 긴 참조 파일에는 목차를 넣어라

100줄이 넘는 참조 파일이라면, 맨 위에 목차를 넣어라. 그러면 pi가 파일 일부만 미리 보더라도 어떤 정보가 들어 있는지 전체 범위를 파악할 수 있다.

**예시**:

```markdown  theme={null}
# API Reference

## Contents
- Authentication and setup
- Core methods (create, read, update, delete)
- Advanced features (batch operations, webhooks)
- Error handling patterns
- Code examples

## Authentication and setup
...

## Core methods
...
```

그렇게 하면 pi는 필요에 따라 파일 전체를 읽거나 특정 섹션으로 바로 이동할 수 있다.

이 파일 시스템 기반 구조가 점진적 공개를 어떻게 가능하게 하는지에 대한 자세한 설명은 아래 고급 섹션의 [Runtime environment](#runtime-environment)를 참고한다.

## 워크플로와 피드백 루프

### 복잡한 작업에는 워크플로를 사용하라

복잡한 작업은 명확하고 순차적인 단계로 나눠라. 특히 복잡도가 높은 워크플로라면, pi가 응답에 그대로 복사해서 진행 상황을 체크할 수 있는 체크리스트를 제공하는 것이 좋다.

**예시 1: 리서치 종합 워크플로** (코드가 없는 스킬용):

````markdown  theme={null}
## Research synthesis workflow

Copy this checklist and track your progress:

```
Research Progress:
- [ ] Step 1: Read all source documents
- [ ] Step 2: Identify key themes
- [ ] Step 3: Cross-reference claims
- [ ] Step 4: Create structured summary
- [ ] Step 5: Verify citations
```

**Step 1: Read all source documents**

Review each document in the `sources/` directory. Note the main arguments and supporting evidence.

**Step 2: Identify key themes**

Look for patterns across sources. What themes appear repeatedly? Where do sources agree or disagree?

**Step 3: Cross-reference claims**

For each major claim, verify it appears in the source material. Note which source supports each point.

**Step 4: Create structured summary**

Organize findings by theme. Include:
- Main claim
- Supporting evidence from sources
- Conflicting viewpoints (if any)

**Step 5: Verify citations**

Check that every claim references the correct source document. If citations are incomplete, return to Step 3.
````

이 예시는 코드가 필요 없는 분석 작업에도 워크플로가 어떻게 적용되는지 보여준다. 체크리스트 패턴은 복잡하고 여러 단계로 이루어진 모든 작업에 사용할 수 있다.

**예시 2: PDF 양식 작성 워크플로** (코드가 있는 스킬용):

````markdown  theme={null}
## PDF form filling workflow

Copy this checklist and check off items as you complete them:

```
Task Progress:
- [ ] Step 1: Analyze the form (run analyze_form.py)
- [ ] Step 2: Create field mapping (edit fields.json)
- [ ] Step 3: Validate mapping (run validate_fields.py)
- [ ] Step 4: Fill the form (run fill_form.py)
- [ ] Step 5: Verify output (run verify_output.py)
```

**Step 1: Analyze the form**

Run: `python scripts/analyze_form.py input.pdf`

This extracts form fields and their locations, saving to `fields.json`.

**Step 2: Create field mapping**

Edit `fields.json` to add values for each field.

**Step 3: Validate mapping**

Run: `python scripts/validate_fields.py fields.json`

Fix any validation errors before continuing.

**Step 4: Fill the form**

Run: `python scripts/fill_form.py input.pdf fields.json output.pdf`

**Step 5: Verify output**

Run: `python scripts/verify_output.py output.pdf`

If verification fails, return to Step 2.
````

명확한 단계는 pi가 중요한 검증 단계를 건너뛰는 일을 막아 준다. 체크리스트는 pi와 사용자 모두가 진행 상황을 추적하는 데 도움이 된다.

### 피드백 루프를 구현하라

**흔한 패턴**: 검증기 실행 -> 오류 수정 -> 반복

이 패턴은 결과물의 품질을 크게 높인다.

**예시 1: 스타일 가이드 준수** (코드가 없는 스킬용):

```markdown  theme={null}
## Content review process

1. Draft your content following the guidelines in STYLE_GUIDE.md
2. Review against the checklist:
   - Check terminology consistency
   - Verify examples follow the standard format
   - Confirm all required sections are present
3. If issues found:
   - Note each issue with specific section reference
   - Revise the content
   - Review the checklist again
4. Only proceed when all requirements are met
5. Finalize and save the document
```

이 예시는 스크립트 대신 참조 문서를 사용해 검증 루프 패턴을 보여준다. 여기서 "검증기"는 STYLE_GUIDE.md이며, pi는 이를 읽고 결과물을 비교함으로써 검토를 수행한다.

**예시 2: 문서 편집 프로세스** (코드가 있는 스킬용):

```markdown  theme={null}
## Document editing process

1. Make your edits to `word/document.xml`
2. **Validate immediately**: `python ooxml/scripts/validate.py unpacked_dir/`
3. If validation fails:
   - Review the error message carefully
   - Fix the issues in the XML
   - Run validation again
4. **Only proceed when validation passes**
5. Rebuild: `python ooxml/scripts/pack.py unpacked_dir/ output.docx`
6. Test the output document
```

검증 루프는 오류를 초기에 잡아낸다.

## 콘텐츠 가이드라인

### 시간에 민감한 정보는 피하라

곧 낡아버릴 정보는 넣지 말라.

**나쁜 예시: 시간 의존적** (곧 틀리게 됨):

```markdown  theme={null}
If you're doing this before August 2025, use the old API.
After August 2025, use the new API.
```

**좋은 예시** ("old patterns" 섹션 활용):

```markdown  theme={null}
## Current method

Use the v2 API endpoint: `api.example.com/v2/messages`

## Old patterns

<details>
<summary>Legacy v1 API (deprecated 2025-08)</summary>

The v1 API used: `api.example.com/v1/messages`

This endpoint is no longer supported.
</details>
```

old patterns 섹션은 메인 내용을 어지럽히지 않으면서도 역사적 맥락을 제공해 준다.

### 용어를 일관되게 사용하라

스킬 전체에서 하나의 용어를 정했다면 끝까지 일관되게 유지하라.

**좋음 - 일관됨**:

* 항상 "API endpoint"
* 항상 "field"
* 항상 "extract"

**나쁨 - 일관되지 않음**:

* "API endpoint", "URL", "API route", "path"를 뒤섞어 사용
* "field", "box", "element", "control"을 뒤섞어 사용
* "extract", "pull", "get", "retrieve"를 뒤섞어 사용

일관성은 pi가 지침을 이해하고 따르는 데 도움이 된다.

## 흔한 패턴

### 템플릿 패턴

출력 형식을 위한 템플릿을 제공하라. 필요한 엄격함의 수준에 맞게 강도를 조절하면 된다.

**엄격한 요구사항이 있을 때** (예: API 응답, 데이터 형식):

````markdown  theme={null}
## Report structure

ALWAYS use this exact template structure:

```markdown
# [Analysis Title]

## Executive summary
[One-paragraph overview of key findings]

## Key findings
- Finding 1 with supporting data
- Finding 2 with supporting data
- Finding 3 with supporting data

## Recommendations
1. Specific actionable recommendation
2. Specific actionable recommendation
```
````

**유연한 안내가 더 적절할 때** (상황에 따라 조정이 유익한 경우):

````markdown  theme={null}
## Report structure

Here is a sensible default format, but use your best judgment based on the analysis:

```markdown
# [Analysis Title]

## Executive summary
[Overview]

## Key findings
[Adapt sections based on what you discover]

## Recommendations
[Tailor to the specific context]
```

Adjust sections as needed for the specific analysis type.
````

### 예시 패턴

결과물의 품질이 예시를 보아야 잘 나오는 스킬이라면, 일반적인 프롬프팅과 마찬가지로 입력/출력 쌍을 제공하라.

````markdown  theme={null}
## Commit message format

Generate commit messages following these examples:

**Example 1:**
Input: Added user authentication with JWT tokens
Output:
```
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware
```

**Example 2:**
Input: Fixed bug where dates displayed incorrectly in reports
Output:
```
fix(reports): correct date formatting in timezone conversion

Use UTC timestamps consistently across report generation
```

**Example 3:**
Input: Updated dependencies and refactored error handling
Output:
```
chore: update dependencies and refactor error handling

- Upgrade lodash to 4.17.21
- Standardize error response format across endpoints
```

Follow this style: type(scope): brief description, then detailed explanation.
````

예시는 설명만으로 전달하는 것보다 원하는 스타일과 디테일 수준을 pi가 더 선명하게 이해하도록 돕는다.

### 조건부 워크플로 패턴

의사결정 지점을 따라 pi를 안내하라.

```markdown  theme={null}
## Document modification workflow

1. Determine the modification type:

   **Creating new content?** -> Follow "Creation workflow" below
   **Editing existing content?** -> Follow "Editing workflow" below

2. Creation workflow:
   - Use docx-js library
   - Build document from scratch
   - Export to .docx format

3. Editing workflow:
   - Unpack existing document
   - Modify XML directly
   - Validate after each change
   - Repack when complete
```

<Tip>
  워크플로가 지나치게 길거나 많은 단계로 복잡해진다면, 별도 파일로 분리하고 현재 작업에 맞는 파일을 읽도록 pi에 안내하는 방식을 고려하라.
</Tip>

## 평가와 반복 개선

### 먼저 평가를 만들어라

**장황한 문서를 쓰기 전에 먼저 평가를 만들어라.** 그래야 실제 문제를 해결하는 스킬을 만들 수 있고, 상상 속 요구사항만 문서화하는 일을 피할 수 있다.

**평가 주도 개발**:

1. **빈틈 찾기**: 스킬 없이 대표 작업을 pi에 수행시켜 보고, 구체적인 실패나 부족한 맥락을 기록한다
2. **평가 만들기**: 이 빈틈을 검증하는 시나리오 3개를 만든다
3. **기준선 설정**: 스킬이 없는 상태에서 pi의 성능을 측정한다
4. **최소한의 지침 작성**: 빈틈을 메우고 평가를 통과하는 데 필요한 만큼만 문서를 쓴다
5. **반복 개선**: 평가를 실행하고, 기준선과 비교하고, 보완한다

이 접근법은 실제 문제를 해결하도록 만들며, 실제로 생기지 않을 수도 있는 요구사항을 미리 상상해 넣는 일을 줄여 준다.

**평가 구조**:

```json  theme={null}
{
  "skills": ["pdf-processing"],
  "query": "Extract all text from this PDF file and save it to output.txt",
  "files": ["test-files/document.pdf"],
  "expected_behavior": [
    "Successfully reads the PDF file using an appropriate PDF processing library or command-line tool",
    "Extracts text content from all pages in the document without missing any pages",
    "Saves the extracted text to a file named output.txt in a clear, readable format"
  ]
}
```

<Note>
  이 예시는 간단한 테스트 기준표를 사용하는 데이터 중심 평가 예시다. 현재는 이런 평가를 실행하는 내장 도구를 제공하지 않는다. 사용자가 자체적인 평가 시스템을 만들 수 있다. 평가는 스킬 효과를 측정하는 가장 중요한 기준이다.
</Note>

### pi와 함께 반복적으로 스킬을 발전시켜라

가장 효과적인 스킬 개발 과정은 pi 자체를 활용하는 방식이다. 한 인스턴스의 pi("pi A")와 함께 다른 인스턴스("pi B")가 사용할 스킬을 만든다. pi A는 지침의 설계와 개선을 도와주고, pi B는 실제 작업에서 그것을 시험한다. 이 방식이 잘 작동하는 이유는 pi 모델이 효과적인 에이전트 지침을 어떻게 써야 하는지와, 에이전트가 어떤 정보를 필요로 하는지를 모두 잘 이해하기 때문이다.

**새 스킬 만들기:**

1. **스킬 없이 작업 완료하기**: 일반적인 프롬프팅으로 pi A와 함께 문제를 해결한다. 이 과정에서 자연스럽게 맥락을 제공하고, 선호를 설명하고, 절차 지식을 공유하게 된다. 어떤 정보를 반복해서 제공하는지 주목하라.

2. **재사용 가능한 패턴 식별하기**: 작업이 끝난 뒤, 비슷한 미래 작업에도 유용할 만한 맥락이 무엇이었는지 정리한다.

   **예시**: BigQuery 분석 작업을 했다면, 테이블 이름, 필드 정의, 필터링 규칙(예: "항상 테스트 계정을 제외한다"), 자주 쓰는 쿼리 패턴 등을 제공했을 수 있다.

3. **pi A에게 스킬 생성 요청하기**: "방금 사용한 BigQuery 분석 패턴을 담은 스킬을 만들어 줘. 테이블 스키마, 이름 규칙, 테스트 계정 제외 규칙을 포함해 줘."

   <Tip>
     pi 모델은 스킬 형식과 구조를 기본적으로 이해한다. 스킬 작성을 위해 특별한 시스템 프롬프트나 별도의 "writing skills" 스킬이 반드시 필요한 것은 아니다. 그냥 스킬을 만들어 달라고 요청하면, 적절한 프런트매터와 본문 구조를 갖춘 SKILL.md 내용을 생성할 수 있다.
   </Tip>

4. **간결성 검토하기**: pi A가 불필요한 설명을 넣지 않았는지 확인한다. 예를 들어 이렇게 요청할 수 있다. "win rate가 무엇인지에 대한 설명은 빼줘. pi는 이미 알고 있어."

5. **정보 구조 개선하기**: pi A에게 내용을 더 효과적으로 정리해 달라고 요청한다. 예: "테이블 스키마는 별도 참조 파일로 분리해 줘. 나중에 테이블이 더 늘어날 수 있어."

6. **유사한 작업으로 테스트하기**: 스킬이 로드된 새로운 pi B 인스턴스로 비슷한 작업을 수행해 본다. pi B가 필요한 정보를 잘 찾는지, 규칙을 올바르게 적용하는지, 작업을 성공적으로 처리하는지 관찰하라.

7. **관찰을 바탕으로 반복 개선하기**: pi B가 놓치거나 어려워하는 부분이 있으면, 구체적인 사례와 함께 pi A에게 돌아간다. 예: "pi가 이 스킬을 쓸 때 Q4 날짜 필터를 빼먹었어. 날짜 필터링 패턴 섹션을 추가해야 할까?"

**기존 스킬 반복 개선하기:**

스킬을 개선할 때도 같은 계층적 패턴을 반복한다. 즉, 다음 세 가지를 번갈아 수행한다.

* **pi A와 작업하기** (스킬 정제를 도와주는 전문가)
* **pi B로 테스트하기** (스킬을 사용해 실제 작업을 수행하는 에이전트)
* **pi B의 동작을 관찰하고 그 통찰을 다시 pi A에게 가져가기**

1. **실제 워크플로에서 스킬 사용하기**: 테스트 시나리오가 아니라 실제 작업을 pi B에게 맡긴다

2. **pi B의 동작 관찰하기**: 어디에서 어려워하는지, 어디에서 잘하는지, 어떤 뜻밖의 선택을 하는지 기록한다

   **예시 관찰**: "pi B에게 지역 매출 보고서를 요청했더니 쿼리는 작성했지만, 스킬에 그 규칙이 있음에도 테스트 계정 제외를 빼먹었다."

3. **개선을 위해 pi A로 돌아가기**: 현재 SKILL.md를 보여 주고 관찰한 내용을 설명한다. 예: "지역 보고서를 요청했을 때 pi B가 테스트 계정 필터를 빼먹었어. 스킬에 필터링 규칙은 있지만, 눈에 잘 안 띄는 것 같아."

4. **pi A의 제안 검토하기**: pi A는 규칙을 더 눈에 띄게 재배치하거나, "always filter"보다 "MUST filter"처럼 더 강한 표현을 쓰거나, 워크플로 섹션 구조를 바꾸는 방안을 제안할 수 있다.

5. **변경 적용 후 다시 테스트하기**: pi A가 다듬은 내용을 반영한 뒤, 비슷한 요청으로 pi B를 다시 테스트한다

6. **실사용을 바탕으로 반복하기**: 새로운 시나리오를 만날 때마다 이 관찰 -> 정제 -> 테스트 순환을 계속한다. 이렇게 하면 가정이 아니라 실제 에이전트 동작을 바탕으로 스킬이 점점 좋아진다.

**팀 피드백 수집하기:**

1. 팀원들과 스킬을 공유하고, 실제 사용 모습을 관찰한다
2. 다음을 묻는다. 예상한 시점에 스킬이 활성화되는가? 지침은 명확한가? 무엇이 빠져 있는가?
3. 피드백을 반영해 자신만의 사용 패턴에서 생긴 사각지대를 보완한다

**왜 이 접근이 잘 작동하는가**: pi A는 에이전트가 무엇을 필요로 하는지 이해하고, 사용자는 도메인 전문성을 제공하며, pi B는 실제 사용을 통해 빈틈을 드러낸다. 그리고 반복 개선을 통해 가정이 아니라 관찰된 동작을 바탕으로 스킬이 발전한다.

### pi가 스킬을 탐색하는 방식을 관찰하라

스킬을 반복 개선할 때는 pi가 실제로 스킬을 어떻게 사용하는지 주의 깊게 살펴보라. 특히 다음을 확인하라.

* **예상 밖의 탐색 경로**: pi가 생각하지 못한 순서로 파일을 읽는가? 그렇다면 구조가 생각만큼 직관적이지 않을 수 있다
* **놓치는 연결**: 중요한 파일로 이어지는 참조를 따라가지 못하는가? 링크를 더 명시적이고 눈에 띄게 만들어야 할 수 있다
* **특정 섹션 과의존**: pi가 같은 파일만 반복해서 읽는다면, 그 내용은 메인 SKILL.md에 들어가야 할 수도 있다
* **무시되는 콘텐츠**: 번들된 파일이 전혀 읽히지 않는다면, 불필요하거나 메인 지침에서 신호가 약한 것일 수 있다

가정이 아니라 이런 관찰을 바탕으로 반복 개선하라. 특히 스킬 메타데이터의 `name`과 `description`은 매우 중요하다. pi는 현재 작업에 반응해 스킬을 활성화할지 결정할 때 이 정보를 사용한다. 스킬이 무엇을 하고 언제 써야 하는지 분명하게 드러나도록 작성하라.

## 피해야 할 안티패턴

### Windows 스타일 경로를 쓰지 마라

Windows 환경에서도 파일 경로에는 항상 슬래시(`/`)를 사용하라.

* 좋음: `scripts/helper.py`, `reference/guide.md`
* 피할 것: `scripts\helper.py`, `reference\guide.md`

유닉스 스타일 경로는 모든 플랫폼에서 동작하지만, Windows 스타일 경로는 유닉스 시스템에서 오류를 일으킨다.

### 선택지를 너무 많이 주지 마라

정말 필요하지 않다면 여러 접근법을 한꺼번에 제시하지 마라.

````markdown  theme={null}
**Bad example: Too many choices** (confusing):
"You can use pypdf, or pdfplumber, or PyMuPDF, or pdf2image, or..."

**Good example: Provide a default** (with escape hatch):
"Use pdfplumber for text extraction:
```python
import pdfplumber
```

For scanned PDFs requiring OCR, use pdf2image with pytesseract instead."
````

## 고급: 실행 가능한 코드가 포함된 스킬

아래 섹션은 실행 가능한 스크립트를 포함하는 스킬에 초점을 맞춘다. 당신의 스킬이 마크다운 지침만 사용한다면, [Checklist for effective Skills](#checklist-for-effective-skills)로 건너뛰면 된다.

### 떠넘기지 말고 해결하라

스킬용 스크립트를 작성할 때는 오류 상황을 처리해야지, pi에게 떠넘기면 안 된다.

**좋은 예시: 오류를 명시적으로 처리함**:

```python  theme={null}
def process_file(path):
    """Process a file, creating it if it doesn't exist."""
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        # Create file with default content instead of failing
        print(f"File {path} not found, creating default")
        with open(path, 'w') as f:
            f.write('')
        return ''
    except PermissionError:
        # Provide alternative instead of failing
        print(f"Cannot access {path}, using default")
        return ''
```

**나쁜 예시: pi에게 떠넘김**:

```python  theme={null}
def process_file(path):
    # Just fail and let pi figure it out
    return open(path).read()
```

설정값 역시 이유가 설명되고 문서화되어 있어야 한다. 그렇지 않으면 "voodoo constants"(Ousterhout의 법칙)가 된다. 당신도 적절한 값을 모른다면, pi가 그 값을 어떻게 판단하겠는가?

**좋은 예시: 스스로 설명되는 값**:

```python  theme={null}
# HTTP requests typically complete within 30 seconds
# Longer timeout accounts for slow connections
REQUEST_TIMEOUT = 30

# Three retries balances reliability vs speed
# Most intermittent failures resolve by the second retry
MAX_RETRIES = 3
```

**나쁜 예시: 매직 넘버**:

```python  theme={null}
TIMEOUT = 47  # Why 47?
RETRIES = 5   # Why 5?
```

### 유틸리티 스크립트를 제공하라

pi가 직접 스크립트를 작성할 수도 있지만, 미리 준비된 스크립트에는 장점이 있다.

**유틸리티 스크립트의 장점**:

* 생성된 코드보다 더 신뢰할 수 있다
* 토큰을 절약한다(코드를 컨텍스트에 넣을 필요가 없다)
* 시간을 절약한다(코드 생성이 필요 없다)
* 여러 번 사용할 때 일관성을 보장한다

지침 파일(forms.md)은 스크립트를 참조하고, pi는 그 내용을 컨텍스트에 로드하지 않고도 bash로 실행할 수 있다.

**중요한 구분**: 지침에서 pi가 다음 중 무엇을 해야 하는지 분명히 밝혀라.

* **스크립트를 실행할 것인지** (대부분의 경우): "필드를 추출하려면 `analyze_form.py`를 실행한다"
* **참고 자료로 읽을 것인지** (복잡한 로직일 때): "필드 추출 알고리즘은 `analyze_form.py`를 참고한다"

대부분의 유틸리티 스크립트는 실행 방식이 더 낫다. 더 신뢰할 수 있고 효율적이기 때문이다. 스크립트 실행 방식이 어떻게 동작하는지는 아래 [Runtime environment](#runtime-environment) 섹션을 참고한다.

**예시**:

````markdown  theme={null}
## Utility scripts

**analyze_form.py**: Extract all form fields from PDF

```bash
python scripts/analyze_form.py input.pdf > fields.json
```

Output format:
```json
{
  "field_name": {"type": "text", "x": 100, "y": 200},
  "signature": {"type": "sig", "x": 150, "y": 500}
}
```

**validate_boxes.py**: Check for overlapping bounding boxes

```bash
python scripts/validate_boxes.py fields.json
# Returns: "OK" or lists conflicts
```

**fill_form.py**: Apply field values to PDF

```bash
python scripts/fill_form.py input.pdf fields.json output.pdf
```
````

### 시각적 분석을 활용하라

입력을 이미지로 렌더링할 수 있다면, pi가 그것을 분석하도록 하라.

````markdown  theme={null}
## Form layout analysis

1. Convert PDF to images:
   ```bash
   python scripts/pdf_to_images.py form.pdf
   ```

2. Analyze each page image to identify form fields
3. pi can see field locations and types visually
````

<Note>
  이 예시에서는 `pdf_to_images.py` 스크립트를 직접 작성해야 한다.
</Note>

pi의 비전 기능은 레이아웃과 구조를 이해하는 데 도움이 된다.

### 검증 가능한 중간 결과물을 만들어라

pi가 복잡하고 개방적인 작업을 수행할 때는 실수할 수 있다. "계획 -> 검증 -> 실행" 패턴은 먼저 구조화된 형식의 계획을 만들고, 그 계획을 스크립트로 검증한 뒤, 통과했을 때만 실행하게 함으로써 오류를 초기에 잡아낸다.

**예시**: 스프레드시트를 바탕으로 PDF 양식의 50개 필드를 수정해 달라고 pi에게 요청했다고 생각해 보자. 검증 없이 진행하면, 존재하지 않는 필드를 참조하거나, 값이 충돌하거나, 필수 필드를 빠뜨리거나, 수정이 잘못 적용될 수 있다.

**해결 방법**: 위의 PDF form filling 워크플로를 사용하되, 적용 전에 검증할 `changes.json`이라는 중간 계획 파일을 추가한다. 그러면 워크플로는 analyze -> **create plan file** -> **validate plan** -> execute -> verify가 된다.

**이 패턴이 잘 작동하는 이유**:

* **오류를 초기에 잡는다**: 실제 변경 전에 검증이 문제를 찾는다
* **기계적으로 검증 가능하다**: 스크립트가 객관적인 검증을 제공한다
* **되돌릴 수 있는 계획 단계가 있다**: 원본을 건드리지 않고도 pi가 계획을 반복 수정할 수 있다
* **디버깅이 명확하다**: 오류 메시지가 구체적인 문제를 가리킨다

**언제 사용할까**: 대량 작업, 파괴적 변경, 복잡한 검증 규칙, 위험도가 높은 작업.

**구현 팁**: 검증 스크립트는 자세하고 구체적인 오류 메시지를 출력하게 하라. 예: "Field 'signature_date' not found. Available fields: customer_name, order_total, signature_date_signed". 그래야 pi가 문제를 스스로 고치기 쉽다.

### 의존 패키지

스킬은 플랫폼별 제약이 있는 코드 실행 환경에서 동작한다.

* **claude.ai**: npm과 PyPI에서 패키지를 설치할 수 있고 GitHub 저장소도 가져올 수 있다
* **Anthropic API**: 네트워크 접근이 없고 런타임 패키지 설치도 불가능하다

필요한 패키지는 반드시 SKILL.md에 명시하고, [code execution tool documentation](/en/docs/agents-and-tools/tool-use/code-execution-tool)에서 실제 사용 가능한지 확인하라.

### 런타임 환경

스킬은 파일 시스템 접근, bash 명령, 코드 실행 기능이 있는 코드 실행 환경에서 동작한다. 이 구조의 개념적 설명은 overview의 [The Skills architecture](/en/docs/agents-and-tools/agent-skills/overview#the-skills-architecture)를 참고한다.

**이 점이 작성 방식에 주는 영향:**

**pi가 스킬에 접근하는 방식:**

1. **메타데이터 사전 로드**: 시작 시 모든 스킬의 YAML 프런트매터에서 name과 description이 시스템 프롬프트에 로드된다
2. **필요할 때 파일 읽기**: pi는 필요할 때 bash Read 도구를 사용해 파일 시스템에서 SKILL.md와 다른 파일을 읽는다
3. **스크립트는 효율적으로 실행됨**: 유틸리티 스크립트는 전체 내용을 컨텍스트에 로드하지 않고 bash로 실행할 수 있다. 토큰을 쓰는 것은 스크립트 출력뿐이다
4. **큰 파일도 즉시 컨텍스트 비용이 없다**: 참조 파일, 데이터, 문서는 실제로 읽기 전까지 컨텍스트 토큰을 소비하지 않는다

* **파일 경로가 중요하다**: pi는 스킬 디렉터리를 파일 시스템처럼 탐색한다. 백슬래시가 아니라 슬래시(`reference/guide.md`)를 사용하라
* **파일 이름은 설명적으로 짓는다**: `doc2.md`가 아니라 `form_validation_rules.md`처럼 내용이 드러나게 한다
* **발견하기 쉽게 구성한다**: 디렉터리를 도메인이나 기능별로 구조화한다
  * 좋음: `reference/finance.md`, `reference/sales.md`
  * 나쁨: `docs/file1.md`, `docs/file2.md`
* **포괄적인 자료를 함께 제공하라**: 완전한 API 문서, 풍부한 예시, 큰 데이터셋도 번들할 수 있다. 접근 전까지는 컨텍스트 비용이 없다
* **결정론적 작업에는 스크립트를 선호하라**: pi에게 검증 코드를 생성하라고 하기보다 `validate_form.py`를 직접 제공하라
* **실행 의도를 분명히 하라**:
  * "필드를 추출하려면 `analyze_form.py`를 실행한다" (execute)
  * "추출 알고리즘은 `analyze_form.py`를 참고한다" (read as reference)
* **파일 접근 패턴을 테스트하라**: 실제 요청을 통해 pi가 디렉터리 구조를 잘 탐색하는지 확인하라

**예시:**

```
bigquery-skill/
├── SKILL.md (overview, points to reference files)
└── reference/
    ├── finance.md (revenue metrics)
    ├── sales.md (pipeline data)
    └── product.md (usage analytics)
```

사용자가 revenue를 물으면, pi는 SKILL.md를 읽고 `reference/finance.md`를 참조한 뒤 bash로 그 파일만 읽는다. sales.md와 product.md는 필요해질 때까지 파일 시스템에 그대로 남아 있고, 그 전까지는 컨텍스트 토큰을 전혀 소비하지 않는다. 이런 파일 시스템 기반 모델이 점진적 공개를 가능하게 한다. pi는 작업마다 필요한 정보만 골라서 로드할 수 있다.

기술 아키텍처 전체에 대한 자세한 내용은 Skills overview의 [How Skills work](/en/docs/agents-and-tools/agent-skills/overview#how-skills-work)를 참고한다.

### MCP 도구 참조

스킬이 MCP(Model Context Protocol) 도구를 사용한다면, "tool not found" 오류를 피하기 위해 항상 완전 수식 도구 이름을 사용하라.

**형식**: `ServerName:tool_name`

**예시**:

```markdown  theme={null}
Use the BigQuery:bigquery_schema tool to retrieve table schemas.
Use the GitHub:create_issue tool to create issues.
```

여기서:

* `BigQuery`, `GitHub`는 MCP 서버 이름이다
* `bigquery_schema`, `create_issue`는 해당 서버 내부의 도구 이름이다

서버 접두사가 없으면, 특히 여러 MCP 서버가 연결되어 있을 때 pi가 도구를 찾지 못할 수 있다.

### 도구가 설치되어 있다고 가정하지 마라

패키지가 이미 설치되어 있다고 가정하지 마라.

````markdown  theme={null}
**Bad example: Assumes installation**:
"Use the pdf library to process the file."

**Good example: Explicit about dependencies**:
"Install required package: `pip install pypdf`

Then use it:
```python
from pypdf import PdfReader
reader = PdfReader("file.pdf")
```"
````

## 기술 메모

### YAML 프런트매터 요구사항

SKILL.md 프런트매터에는 `name`(최대 64자)과 `description`(최대 1024자) 필드가 필요하다. 전체 구조에 대한 자세한 내용은 [Skills overview](/en/docs/agents-and-tools/agent-skills/overview#skill-structure)를 참고한다.

### 토큰 예산

최적 성능을 위해 SKILL.md 본문은 500줄 이하로 유지하라. 이를 넘는다면, 앞에서 설명한 점진적 공개 패턴을 사용해 별도 파일로 분리한다. 아키텍처 세부 내용은 [Skills overview](/en/docs/agents-and-tools/agent-skills/overview#how-skills-work)를 참고한다.

## 효과적인 스킬 체크리스트

스킬을 공유하기 전에 다음을 확인하라.

### 핵심 품질

* [ ] Description이 구체적이고 핵심 용어를 포함한다
* [ ] Description에 스킬이 무엇을 하는지와 언제 써야 하는지가 모두 들어 있다
* [ ] SKILL.md 본문이 500줄 이하이다
* [ ] 추가 상세 내용은 별도 파일로 분리했다(필요한 경우)
* [ ] 시간에 민감한 정보가 없다(있다면 "old patterns" 섹션에 있다)
* [ ] 용어가 전체적으로 일관된다
* [ ] 예시가 추상적이지 않고 구체적이다
* [ ] 파일 참조가 한 단계 깊이로 유지된다
* [ ] 점진적 공개가 적절히 사용되었다
* [ ] 워크플로 단계가 명확하다

### 코드와 스크립트

* [ ] 스크립트가 문제를 해결하지 pi에게 떠넘기지 않는다
* [ ] 오류 처리가 명시적이고 도움이 된다
* [ ] "voodoo constants"가 없다(모든 값에 근거가 있다)
* [ ] 필요한 패키지를 지침에 명시했고 사용 가능 여부를 확인했다
* [ ] 스크립트 문서화가 명확하다
* [ ] Windows 스타일 경로가 없다(모두 슬래시 사용)
* [ ] 중요한 작업에는 검증/확인 단계가 있다
* [ ] 품질이 중요한 작업에는 피드백 루프가 포함되어 있다

### 테스트

* [ ] 최소 3개의 평가를 만들었다
* [ ] Haiku, Sonnet, Opus에서 테스트했다
* [ ] 실제 사용 시나리오로 테스트했다
* [ ] 팀 피드백을 반영했다(해당되는 경우)

## 다음 단계

* [Get started with Agent Skills](/en/docs/agents-and-tools/agent-skills/quickstart) - 첫 번째 스킬 만들기
* [Use Skills in pi](/en/docs/claude-code/skills) - pi에서 스킬 만들고 관리하기
* [Use Skills with the API](/en/api/skills-guide) - 스킬을 업로드하고 프로그래밍 방식으로 사용하기
