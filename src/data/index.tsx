import { createContext, useContext, type ReactNode } from "react";
import schedule from "./schedule.json";
import type { ScheduleData } from "./types";
import { buildIndex, type DataIndex } from "../domain/lookup";
import { buildSearchIndex, type SearchIndex } from "../domain/filters";

export interface AppData {
  data: ScheduleData;
  index: DataIndex;
  search: SearchIndex;
}

export function buildAppData(data: ScheduleData): AppData {
  const index = buildIndex(data);
  return { data, index, search: buildSearchIndex(data, index) };
}

export const data = schedule as unknown as ScheduleData;
export const index = buildIndex(data);
export const search = buildSearchIndex(data, index);

const DataContext = createContext<AppData>({ data, index, search });

export function DataProvider({ value, children }: { value: AppData; children: ReactNode }) {
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): AppData {
  return useContext(DataContext);
}
