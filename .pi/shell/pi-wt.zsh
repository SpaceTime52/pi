# pi-wt 셸 헬퍼 — 현재 셸을 워크트리로 cd 하고 pi 실행
#
# 설치 (한 번만):
#   ~/.zshrc 또는 ~/.bashrc 에 추가:
#     [ -f ~/.pi/agent/git/github.com/SpaceTime52/pi/.pi/shell/pi-wt.zsh ] && \
#       source ~/.pi/agent/git/github.com/SpaceTime52/pi/.pi/shell/pi-wt.zsh
#
# 사용:
#   pi-wt-here <name>          # 현재 셸이 워크트리로 cd → pi 실행
#   pi-wt-here feature-my-task
#   pi-wt-here pr-1234
#
# 자동완성 (zsh):
#   _pi_wt_here_complete  보조 함수가 자동완성 후보를 채워줌
#
# 병렬 작업:
#   1. Cmd+N (또는 Cmd+T) 으로 새 Ghostty 윈도우/탭 열기
#   2. 그 셸에서 pi-wt-here <other-name>
#   3. 반복

pi-wt-here() {
    if [[ -z "${1:-}" ]]; then
        echo "usage: pi-wt-here <worktree-name>" >&2
        echo "  available worktrees:" >&2
        pi-wt list 2>/dev/null | tail -n +3 | awk '{print "    " $1}' >&2
        return 1
    fi
    local p
    p="$(pi-wt cd "$1")" || return 1
    cd "$p" && pi
}

# zsh 자동완성: 현재 repo의 워크트리 이름 후보 제공
if [[ -n "${ZSH_VERSION:-}" ]]; then
    _pi_wt_here_complete() {
        local -a names
        names=("${(@f)$(pi-wt list 2>/dev/null | tail -n +3 | awk 'NF{print $1}')}")
        compadd -a names
    }
    compdef _pi_wt_here_complete pi-wt-here 2>/dev/null
fi
