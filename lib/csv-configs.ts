import type { CSVColumnConfig } from "@/components/common/csv-import-export";
import type { UserTag, CalculationTag, StatsTag } from "@/lib/stores/configuration-store";

// User Tag CSV Configuration
export const userTagColumns: CSVColumnConfig<UserTag>[] = [
  { key: 'name', header: 'Name', required: true },
  { key: 'dataType', header: 'Data Type', defaultValue: 'Analog' },
  { key: 'defaultValue', header: 'Default Value', defaultValue: 0, transform: (value: string) => parseFloat(value) || 0 },
  { key: 'spanHigh', header: 'Span High', defaultValue: 1000, transform: (value: string) => parseFloat(value) || 1000 },
  { key: 'spanLow', header: 'Span Low', defaultValue: 0, transform: (value: string) => parseFloat(value) || 0 },
  { key: 'readWrite', header: 'Read Write', defaultValue: 'Read/Write' },
  { key: 'description', header: 'Description', defaultValue: '' },
];

// Calculation Tag CSV Configuration
export const calculationTagColumns: CSVColumnConfig<CalculationTag>[] = [
  { key: 'name', header: 'Name', required: true },
  { key: 'defaultValue', header: 'Default Value', defaultValue: 0, transform: (value: string) => parseFloat(value) || 0 },
  { key: 'formula', header: 'Formula', required: true },
  { key: 'a', header: 'Variable A', defaultValue: '' },
  { key: 'b', header: 'Variable B', defaultValue: '' },
  { key: 'c', header: 'Variable C', defaultValue: '' },
  { key: 'd', header: 'Variable D', defaultValue: '' },
  { key: 'e', header: 'Variable E', defaultValue: '' },
  { key: 'f', header: 'Variable F', defaultValue: '' },
  { key: 'g', header: 'Variable G', defaultValue: '' },
  { key: 'h', header: 'Variable H', defaultValue: '' },
  { key: 'period', header: 'Period', defaultValue: 1, transform: (value: string) => parseInt(value) || 1 },
  { key: 'description', header: 'Description', defaultValue: '' },
];

// Stats Tag CSV Configuration
export const statsTagColumns: CSVColumnConfig<StatsTag>[] = [
  { key: 'name', header: 'Name', required: true },
  { key: 'referTag', header: 'Reference Tag', required: true },
  { key: 'type', header: 'Type', defaultValue: 'Average' },
  { key: 'updateCycleValue', header: 'Update Cycle Value', defaultValue: 60, transform: (value: string) => parseInt(value) || 60 },
  { key: 'updateCycleUnit', header: 'Update Cycle Unit', defaultValue: 'sec' },
  { key: 'description', header: 'Description', defaultValue: '' },
];

// Validation functions for each tag type
export const validateUserTag = (tag: UserTag, index: number): string[] => {
  const errors: string[] = [];
  
  if (!tag.name || tag.name.trim().length < 3) {
    errors.push("Name must be at least 3 characters");
  }
  
  if (!/^[a-zA-Z0-9-_]+$/.test(tag.name)) {
    errors.push("Name can only contain letters, numbers, hyphens, and underscores");
  }
  
  if (!['Analog', 'Discrete'].includes(tag.dataType)) {
    errors.push("Data Type must be either 'Analog' or 'Discrete'");
  }
  
  if (!['Read/Write', 'Read Only'].includes(tag.readWrite)) {
    errors.push("Read Write must be either 'Read/Write' or 'Read Only'");
  }
  
  return errors;
};

export const validateCalculationTag = (tag: CalculationTag, index: number): string[] => {
  const errors: string[] = [];
  
  if (!tag.name || tag.name.trim().length < 3) {
    errors.push("Name must be at least 3 characters");
  }
  
  if (!/^[a-zA-Z0-9-_]+$/.test(tag.name)) {
    errors.push("Name can only contain letters, numbers, hyphens, and underscores");
  }
  
  if (!tag.formula || tag.formula.trim().length === 0) {
    errors.push("Formula is required");
  }
  
  return errors;
};

export const validateStatsTag = (tag: StatsTag, index: number): string[] => {
  const errors: string[] = [];
  
  if (!tag.name || tag.name.trim().length < 3) {
    errors.push("Name must be at least 3 characters");
  }
  
  if (!/^[a-zA-Z0-9-_]+$/.test(tag.name)) {
    errors.push("Name can only contain letters, numbers, hyphens, and underscores");
  }
  
  if (!tag.referTag || tag.referTag.trim().length === 0) {
    errors.push("Reference Tag is required");
  }
  
  if (!['Average', 'Max', 'Min', 'Sum'].includes(tag.type)) {
    errors.push("Type must be one of: Average, Max, Min, Sum");
  }
  
  if (!['sec', 'min', 'hour', 'day'].includes(tag.updateCycleUnit)) {
    errors.push("Update Cycle Unit must be one of: sec, min, hour, day");
  }
  
  return errors;
};
