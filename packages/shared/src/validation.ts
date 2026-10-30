import type { QuestCreationInput, QuestFilter, QuestUpdateInput } from "./types";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> };

const required = (value: string | undefined, field: string, errors: Record<string, string>) => {
  if (!value?.trim()) errors[field] = `${field} is required`;
};

export function validateQuestCreation(input: QuestCreationInput): ValidationResult<QuestCreationInput> {
  const errors: Record<string, string> = {};
  required(input.title, "title", errors);
  required(input.description, "description", errors);
  required(input.locationLabel, "locationLabel", errors);
  if (input.title.trim().length > 80) errors.title = "Title must be 80 characters or fewer";
  if (input.description.trim().length > 1000) errors.description = "Description must be 1000 characters or fewer";
  if (!Number.isInteger(input.capacity) || input.capacity < 2 || input.capacity > 100) errors.capacity = "Capacity must be between 2 and 100";
  if (input.endTime <= input.startTime) errors.endTime = "End time must be after start time";
  if (input.minimumAge < 16 || input.minimumAge > 100) errors.minimumAge = "Minimum age must be between 16 and 100";
  if (input.estimatedCost && (input.estimatedCost.amount < 0 || !Number.isFinite(input.estimatedCost.amount))) errors.estimatedCost = "Cost must be zero or greater";
  return Object.keys(errors).length ? { success: false, errors } : { success: true, data: input };
}

export function validateQuestUpdate(input: QuestUpdateInput): ValidationResult<QuestUpdateInput> {
  const errors: Record<string, string> = {};
  if (input.title !== undefined && (!input.title.trim() || input.title.length > 80)) errors.title = "Title must be 1–80 characters";
  if (input.description !== undefined && (!input.description.trim() || input.description.length > 1000)) errors.description = "Description must be 1–1000 characters";
  if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity < 2 || input.capacity > 100)) errors.capacity = "Capacity must be between 2 and 100";
  if (input.startTime && input.endTime && input.endTime <= input.startTime) errors.endTime = "End time must be after start time";
  return Object.keys(errors).length ? { success: false, errors } : { success: true, data: input };
}

export function validateQuestFilter(input: QuestFilter): ValidationResult<QuestFilter> {
  const errors: Record<string, string> = {};
  if (input.maxCost !== undefined && (!Number.isFinite(input.maxCost) || input.maxCost < 0)) errors.maxCost = "Maximum cost must be zero or greater";
  return Object.keys(errors).length ? { success: false, errors } : { success: true, data: input };
}
