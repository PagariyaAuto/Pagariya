
import type { ComponentProps } from "react";
import SurveyForm from "./SurveyForm";

type SurveyStageProps = ComponentProps<typeof SurveyForm>;

export default function SurveyStage(props: SurveyStageProps) {
  return <SurveyForm {...props} />;
}
  