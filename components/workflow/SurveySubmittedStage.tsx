
import type { ComponentProps } from "react";
import SurveyDetails from "./SurveyDetails";

type SurveySubmittedStageProps = ComponentProps<typeof SurveyDetails>;

export default function SurveySubmittedStage(
  props: SurveySubmittedStageProps
) {
  return <SurveyDetails {...props} />;
}
  