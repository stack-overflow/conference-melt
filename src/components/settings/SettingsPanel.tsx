import { useMemo, type ReactNode, type RefObject } from "react";
import { useData } from "../../data/index";
import { usePlanSet, useStore, type ColumnAxis, type Settings, type TimeMode } from "../../state/store";
import { daySets, resolveTimeMode } from "../../state/derive";
import { Popover } from "../ui/Popover";
import { Sheet } from "../ui/Sheet";
import { Segmented } from "../ui/Segmented";
import { Slider } from "../ui/Slider";
import { Toggle } from "../ui/Toggle";
import styles from "./SettingsPanel.module.css";

interface Props {
  variant: "popover" | "sheet";
  anchorRef?: RefObject<HTMLElement | null>;
  open: boolean;
  onClose(): void;
}

const AXIS_OPTIONS: { value: ColumnAxis; label: string }[] = [
  { value: "location", label: "Sale" },
  { value: "type", label: "Typ" },
  { value: "brand", label: "Marka" },
  { value: "level", label: "Poziom" },
  { value: "none", label: "Bez grupowania" },
];

const TIME_OPTIONS: { value: TimeMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "slots", label: "Sloty" },
  { value: "timeline", label: "Oś czasu" },
];

const DENSITY_OPTIONS: { value: Settings["density"]; label: string }[] = [
  { value: "compact", label: "Zwarty" },
  { value: "comfortable", label: "Wygodny" },
];

const COLOR_OPTIONS: { value: Settings["colorBy"]; label: string }[] = [
  { value: "type", label: "Typ" },
  { value: "location", label: "Miejsce" },
  { value: "brand", label: "Marka" },
];

const THEME_OPTIONS: { value: Settings["theme"]; label: string }[] = [
  { value: "system", label: "System" },
  { value: "dark", label: "Ciemny" },
  { value: "light", label: "Jasny" },
];

interface FieldProps {
  label?: string;
  hint: ReactNode;
  children: ReactNode;
}

/** One setting: optional visible caption, the control, and its one-line hint. */
function Field({ label, hint, children }: FieldProps) {
  return (
    <div className={styles.field}>
      {label !== undefined ? <div className={styles.fieldLabel}>{label}</div> : null}
      {children}
      <p className={styles.hint}>{hint}</p>
    </div>
  );
}

export function SettingsPanel({ variant, anchorRef, open, onClose }: Props) {
  const { data, index, search } = useData();
  const settings = useStore((s) => s.settings);
  const day = useStore((s) => s.day);
  const view = useStore((s) => s.view);
  const filters = useStore((s) => s.filters);
  const setSettings = useStore((s) => s.setSettings);
  const resetSettings = useStore((s) => s.resetSettings);
  const planSet = usePlanSet();

  const autoReadout = useMemo(() => {
    const sets = daySets({ data, index, search, dayId: day, filters, settings, planSet, planView: view === "plan" });
    const resolved = resolveTimeMode({ ...settings, timeMode: "auto" }, sets.layout);
    return resolved.mode === "slots" ? "Auto (sloty)" : "Auto (oś czasu)";
  }, [data, index, search, day, filters, settings, planSet, view]);

  const body = (
    <div className={styles.panel}>
      <Field label="Kolumny" hint="Co tworzy kolumny siatki">
        <Segmented value={settings.columnAxis} options={AXIS_OPTIONS} onChange={(v) => setSettings({ columnAxis: v })} ariaLabel="Kolumny" />
      </Field>
      <Field
        label="Tryb czasu"
        hint={
          <>
            Auto wybiera sloty, gdy widoczne starty tworzą regularną siatkę. Teraz: <span className={styles.readout}>{autoReadout}</span>
          </>
        }
      >
        <Segmented value={settings.timeMode} options={TIME_OPTIONS} onChange={(v) => setSettings({ timeMode: v })} ariaLabel="Tryb czasu" />
      </Field>
      <Field hint="Starty w tym odstępie trafiają do jednego slotu">
        <Slider
          value={settings.slotTolerance}
          min={5}
          max={45}
          step={5}
          onChange={(v) => setSettings({ slotTolerance: v })}
          label="Tolerancja slotów"
          format={(v) => `${v} min`}
        />
      </Field>
      <Field hint="Wysokość jednej minuty w osi czasu">
        <Slider
          value={settings.zoom}
          min={1.2}
          max={4}
          step={0.2}
          onChange={(v) => setSettings({ zoom: Math.round(v * 10) / 10 })}
          label="Powiększenie"
          format={(v) => `${v.toFixed(1)} px/min`}
        />
      </Field>
      <Field label="Gęstość" hint="Rozmiar kart i szerokość kolumn">
        <Segmented value={settings.density} options={DENSITY_OPTIONS} onChange={(v) => setSettings({ density: v })} ariaLabel="Gęstość" />
      </Field>
      <Field label="Kolor" hint="Skąd bierze się kolor krawędzi karty">
        <Segmented value={settings.colorBy} options={COLOR_OPTIONS} onChange={(v) => setSettings({ colorBy: v })} ariaLabel="Kolor" />
      </Field>
      <Toggle
        checked={settings.showAvatars}
        onChange={(v) => setSettings({ showAvatars: v })}
        label="Zdjęcia prelegentów"
        hint="Na kartach i w liście; w szczegółach zawsze"
      />
      <Toggle
        checked={settings.allDayStrip}
        onChange={(v) => setSettings({ allDayStrip: v })}
        label="Strefy całodniowe w osobnym pasku"
        hint="Wyłączone: strefy stają się pasami w siatce"
      />
      {variant === "sheet" ? (
        <Field label="Motyw" hint="System podąża za ustawieniem urządzenia">
          <Segmented value={settings.theme} options={THEME_OPTIONS} onChange={(v) => setSettings({ theme: v })} ariaLabel="Motyw" />
        </Field>
      ) : null}
      <button type="button" className={styles.reset} onClick={resetSettings}>
        Przywróć domyślne
      </button>
    </div>
  );

  if (variant === "sheet") {
    return (
      <Sheet open={open} side="bottom" title="Widok" onClose={onClose}>
        {body}
      </Sheet>
    );
  }
  if (!anchorRef) return null;
  return (
    <Popover open={open} anchorRef={anchorRef} onClose={onClose} title="Widok">
      {body}
    </Popover>
  );
}
