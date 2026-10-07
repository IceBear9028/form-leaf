import { MarkdownContent } from "./markdown/MarkdownContent";
import { getResumeStyleSheet } from "./style/registry";

const prototypeStyle = getResumeStyleSheet(
  new URLSearchParams(window.location.search).get("style") ?? "reference-resume-v1",
);

const projectExample = `프로젝트의 목적과 담당 역할을 간단히 설명합니다.

### 검색 성능 개선

요청 조건이 많아질수록 응답 시간이 길어지는 문제가 있었습니다.

- 검색 조건과 요청 구조를 단순화했습니다.
- 반복 요청에 캐시를 적용했습니다.
- 평균 응답 시간을 **40% 단축**했습니다.

자세한 내용은 [프로젝트 문서](https://example.com)에서 확인할 수 있습니다.
중요한 지표에는 ++밑줄 표현++을 사용할 수 있습니다.`;

const freeTextExample = `문단은 빈 줄로 구분하고, 한 번의 줄바꿈은
같은 문단 안의 강제 줄바꿈으로 표시합니다.

### 추가 경험

- 첫 번째 일반 목록
- 두 번째 **강조 목록**`;

export function MarkdownPrototype() {
  return (
    <main className="markdown-prototype-shell">
      <div className="markdown-prototype-note">
        <strong>Markdown 렌더링 프로토타입</strong>
        <span>{prototypeStyle.name} · 문법·스타일 검증 화면입니다.</span>
      </div>
      <article className={`resume-page ${prototypeStyle.className}`} style={prototypeStyle.variables}>
        <div className="resume-page-body">
          <div className="layout-unit layout-unit--heading layout-unit--heading-project layout-unit--separator layout-unit--first">
            <div className="resume-section-heading"><h2>프로젝트</h2></div>
          </div>
          <div className="layout-unit layout-unit--project layout-unit--has-blocks layout-unit--line-segment layout-unit--line-start">
            <div className="resume-grid-row">
              <div className="resume-meta-column">
                <strong className="meta-period">2025. 01 ~ 현재</strong>
                <span className="meta-organization">개인 프로젝트</span>
              </div>
              <div className="resume-body-column project-body"><h3>Markdown 기반 이력서 본문</h3></div>
            </div>
          </div>
          <div className="layout-unit layout-unit--block layout-unit--line-segment layout-unit--line-end">
            <div className="resume-grid-row resume-grid-row--continuation resume-grid-row--project">
              <div className="resume-meta-column" />
              <div className="resume-body-column">
                <MarkdownContent source={projectExample} context="project" />
              </div>
            </div>
          </div>

          <div className="layout-unit layout-unit--heading layout-unit--heading-free-text layout-unit--separator">
            <div className="resume-section-heading"><h2>추가 내용</h2></div>
          </div>
          <div className="layout-unit layout-unit--block">
            <div className="resume-grid-row resume-grid-row--continuation resume-grid-row--free-text">
              <div className="resume-meta-column" />
              <div className="resume-body-column">
                <MarkdownContent source={freeTextExample} context="free-text" />
              </div>
            </div>
          </div>
        </div>
        <footer className="resume-page-number">1 / 1</footer>
      </article>
    </main>
  );
}
