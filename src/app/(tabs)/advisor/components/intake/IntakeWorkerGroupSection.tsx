import { SectionCard, SegmentedTabs } from "./IntakeUI";
type IntakeStyles = Record<string, any>;
type WorkerGroup = "CNT" | "PNPL";
export function IntakeWorkerGroupSection({ workerGroup, onWorkerGroupChange, styles }: { workerGroup: WorkerGroup; onWorkerGroupChange: (value: WorkerGroup) => void; styles: IntakeStyles }) {
  return <SectionCard eyebrow="04" title="Worker Group" subtitle="Select the worker group responsible for this vehicle." styles={styles}>
    <SegmentedTabs options={[{ value: "CNT", label: "CNT", icon: "people-outline" }, { value: "PNPL", label: "PNPL", icon: "people-outline" }]} value={workerGroup} onChange={v => onWorkerGroupChange(v as WorkerGroup)} styles={styles} />
  </SectionCard>;
}
