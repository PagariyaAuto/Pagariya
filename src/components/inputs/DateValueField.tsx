import DateTimeField, { type DateTimeFieldProps } from "./DateTimeField";
export type DateValueFieldProps = Omit<DateTimeFieldProps, "value" | "onChange" | "title"> & {
  title?: string; label: string; value: Date; onChange: (value: Date) => void;
};
/** Adapt existing Date state without changing its ISO payload at submission. */
export default function DateValueField({ title, label, value, onChange, ...props }: DateValueFieldProps) {
  return <DateTimeField {...props} required={props.required ?? true} title={title || label} label={label}
    value={Number.isFinite(value.getTime()) ? value.toISOString() : null}
    onChange={next => { if (next) onChange(new Date(next)); }} />;
}
