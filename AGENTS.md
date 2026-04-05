# AGENTS.md

이 파일은 레포 작업 시 AI 에이전트(Claude Code, Cursor 등)와 기여자가 참고하는 프로젝트 규약이다.

## 기본 규칙

- README는 플레인 텍스트, 박스 가운데 정렬 유지
- 리소스(extension, skill) 변경 시 README 최신화
- 커밋 메시지는 한국어, prefix(`feat:`, `fix:` 등) 사용 안 함

## 디렉토리 구조

```
extensions/<name>/
├── index.ts          # import + export default function(pi) {...} 만 허용 (Go 테스트 강제)
├── README            # 필수 (Go 테스트 강제)
├── core/             # 비즈니스 로직
└── __tests__/        # 단위 테스트

skills/<name>/SKILL.md     # pi 스킬 정의
.claude/agents/*.md        # 서브에이전트 (subagent 확장이 discoverAgents로 로드)
tests/                     # Go 구조 테스트 (디렉토리/네이밍 enforce)
```

extension 최상위는 `index.ts`와 `README`만 허용. 나머지는 `core/` 하위로 분리.

## 타입 안전성

`tsconfig.json` 옵션:
- `strict: true`
- `exactOptionalPropertyTypes: true`
- `noUncheckedIndexedAccess: true`
- `noUnusedLocals: true`

## 린트/포맷

- Biome 2.4.10 via **local npm devDependency** (NOT via mise)
- `npm run lint` / `npm run format` / `npm run typecheck`

## 금지 패턴 (lefthook `no-bypass` hook이 강제)

소스 코드에서 금지 (테스트 파일 제외):
- `@ts-nocheck`
- `biome-ignore` (주석 및 block)
- `c8 ignore`
- `as any`
- `as unknown as`

테스트 파일(`__tests__/`)에서는 `as unknown as`만 예외적으로 허용 — SDK mock 용도.

## 주석 언어

- **사용자 대면 문자열** (TUI, 에러 메시지, 커맨드 help): 한국어
- **커밋 메시지**: 한국어
- **소스 코드 주석**: 영어
- **문서(README, AGENTS.md, SKILL.md)**: 한국어

## 테스트 정책

- 프레임워크: `node:test` + `node:assert/strict` (외부 의존 없음)
- 커버리지 목표: 100% (`c8 --100`) 전 메트릭 (statements/branches/functions/lines)
- 4개 스위트: subagent, claude-mcp-bridge, claude-hooks-bridge, cross-agent
- 단일 진입점: `npm test` (모든 스위트 + Go 구조 테스트)

### 커버리지 제외 기준

특정 파일은 명시적으로 `--exclude`로 제외 가능. 제외 사유:
- 서브프로세스 스폰 (`extensions/subagent/execution/runner.ts`)
- TUI 렌더링 (`extensions/claude-mcp-bridge/core/overlay-*.ts`)
- 네트워크 I/O (`extensions/claude-mcp-bridge/core/connection.ts`, `manager.ts`)
- pi SDK 긴밀 통합 (`extensions/claude-mcp-bridge/core/bridge.ts`)

제외된 파일은 통합 테스트 범위이며 단위 테스트 대상 아님.

## 커밋 규약

- AI 작성 커밋: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` trailer 추가
- 지라 이슈 번호 포함 안 함

## 외부 링크

- pi-mono: https://github.com/badlogic/pi-mono
- 원본 (포트 베이스): https://github.com/Jonghakseo/my-pi
