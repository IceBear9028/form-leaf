/**
 * 현재 앱이 사용하는 과거 저장 계약의 격리 진입점이다.
 *
 * 앱 전환 전까지 실제 타입 정의는 기존 화면과 공유한다. generic document core는
 * 이 모듈이나 과거 계약을 import하지 않는다. 전환이 끝나면 타입 정의와 validator도
 * 이 경계 안으로 이동한다.
 */
export {
  isResumeDocument as isLegacyV2Document,
  isV1ResumeDocument as isLegacyV1Document,
} from "../../../foundation/content/resume.ts";

export type {
  ContentBlock as LegacyContentBlock,
  ProfileSection as LegacyProfileSection,
  ProjectGroupSection as LegacyProjectGroupSection,
  ProjectItem as LegacyProjectItem,
  ResumeDocument as LegacyV2Document,
  ResumeLink as LegacyLink,
  ResumeSection as LegacySection,
  TextContent as LegacyTextContent,
  TimelineItem as LegacyTimelineItem,
  TimelineSection as LegacyTimelineSection,
  V1ProjectItem as LegacyV1ProjectItem,
  V1ResumeDocument as LegacyV1Document,
} from "../../../foundation/content/resume.ts";
