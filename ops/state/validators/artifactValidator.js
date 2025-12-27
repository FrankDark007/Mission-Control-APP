/**
 * Mission Control V7 — Artifact Validator
 * Validates artifact structure and enforces mutability rules
 */

import { ArtifactTypes, ArtifactModes, ArtifactModeDefaults, isValidArtifactType, getDefaultArtifactMode } from '../ArtifactTypes.js';

// Backwards compatibility aliases
const ArtifactMode = ArtifactModes;
const ArtifactModeMap = ArtifactModeDefaults;
const getArtifactMode = getDefaultArtifactMode;

// ============================================
// ERROR CODES
// ============================================

export const ArtifactErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_TYPE: 'INVALID_TYPE',
  MISSING_REQUIRED: 'MISSING_REQUIRED',
  IMMUTABLE_VIOLATION: 'IMMUTABLE_VIOLATION',
  INVALID_PROVENANCE: 'INVALID_PROVENANCE'
};

// ============================================
// VALIDATION RESULT
// ============================================

function validationResult(valid, errors = [], code = null) {
  return { valid, errors, code };
}

// ============================================
// ARTIFACT VALIDATOR
// ============================================

export function validateArtifact(artifact) {
  const errors = [];

  // Required fields
  if (!artifact.id) errors.push('id is required');
  if (!artifact.missionId) errors.push('missionId is required');
  if (!artifact.type) errors.push('type is required');
  if (!artifact.label) errors.push('label is required');

  if (errors.length > 0) {
    return validationResult(false, errors, ArtifactErrorCode.MISSING_REQUIRED);
  }

  // Validate type
  if (!isValidArtifactType(artifact.type)) {
    return validationResult(false, [`Invalid artifact type: ${artifact.type}`], ArtifactErrorCode.INVALID_TYPE);
  }

  // Validate provenance
  if (!artifact.provenance) {
    errors.push('provenance is required');
  } else {
    if (!artifact.provenance.producer) {
      errors.push('provenance.producer is required');
    }
    const validProducers = ['agent', 'watchdog', 'system', 'human'];
    if (artifact.provenance.producer && !validProducers.includes(artifact.provenance.producer)) {
      errors.push(`Invalid producer: ${artifact.provenance.producer}. Must be one of: ${validProducers.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    return validationResult(false, errors, ArtifactErrorCode.INVALID_PROVENANCE);
  }

  return validationResult(true);
}

// ============================================
// MUTABILITY ENFORCEMENT
// ============================================

export function validateArtifactUpdate(existingArtifact, updates) {
  const mode = getArtifactMode(existingArtifact.type);

  if (mode === ArtifactMode.IMMUTABLE) {
    return validationResult(
      false,
      [`Artifact ${existingArtifact.id} is immutable and cannot be modified`],
      ArtifactErrorCode.IMMUTABLE_VIOLATION
    );
  }

  if (mode === ArtifactMode.APPEND_ONLY) {
    // Only payload and files can be appended
    const allowedKeys = ['payload', 'files'];
    const attemptedKeys = Object.keys(updates);
    const disallowedKeys = attemptedKeys.filter(k => !allowedKeys.includes(k));

    if (disallowedKeys.length > 0) {
      return validationResult(
        false,
        [`Append-only artifact can only update: ${allowedKeys.join(', ')}. Attempted: ${disallowedKeys.join(', ')}`],
        ArtifactErrorCode.IMMUTABLE_VIOLATION
      );
    }
  }

  return validationResult(true);
}

// ============================================
// ARTIFACT CREATION HELPER
// ============================================

export function createArtifactObject(data) {
  const validation = validateArtifact(data);
  if (!validation.valid) {
    const error = new Error(validation.errors.join('; '));
    error.code = validation.code;
    throw error;
  }

  return {
    id: data.id,
    missionId: data.missionId,
    taskId: data.taskId || null,
    type: data.type,
    artifactMode: getArtifactMode(data.type),
    label: data.label,
    payload: data.payload || null,
    files: data.files || [],
    provenance: {
      producer: data.provenance.producer,
      agentId: data.provenance.agentId || null,
      worktree: data.provenance.worktree || null,
      commitHash: data.provenance.commitHash || null
    },
    createdAt: new Date().toISOString()
  };
}

export default {
  validateArtifact,
  validateArtifactUpdate,
  createArtifactObject,
  ArtifactErrorCode
};
