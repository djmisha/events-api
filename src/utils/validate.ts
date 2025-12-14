/**
 * Validation Utilities
 *
 * Centralized validation using Joi schemas for type-safe input validation.
 * All external data (API inputs, partner API responses) should be validated
 * before processing to ensure data integrity and provide clear error messages.
 */

import joi from "joi";
import { PartnerEvent, ArtistInput } from "../types";

/**
 * Joi schema for artist creation input
 * Validates all required fields and constraints for new artist records
 */
const artistInputSchema = joi.object({
  name: joi
    .string()
    .min(1)
    .max(255)
    .trim()
    .pattern(/^.*\S+.*$/, "non-whitespace")
    .required()
    .messages({
      "string.pattern.name":
        "Name must contain at least one non-whitespace character",
    }),
  slug: joi
    .string()
    .min(1)
    .max(255)
    .pattern(/^[a-z0-9-]+$/, "url-safe")
    .optional()
    .messages({
      "string.pattern.name":
        "Slug must contain only lowercase letters, numbers, and hyphens",
    }),
  image: joi.string().uri().allow(null).optional(),
  tags: joi.array().items(joi.string()).min(1).optional(),
  ticketmaster_id: joi.string().allow(null).optional(),
  edmtrain_id: joi.number().integer().allow(null).optional(),
  bio: joi.string().max(5000).allow(null).optional(),
  metadata: joi
    .object()
    .max(20)
    .pattern(
      joi.string(),
      joi.any().when(joi.ref("."), {
        is: joi.object(),
        then: joi.object().max(5),
        otherwise: joi.any(),
      })
    )
    .optional()
    .messages({
      "object.max": "Metadata can contain at most 20 top-level keys",
    }),
});

const artistUpdateSchema = joi.object({
  name: joi
    .string()
    .min(1)
    .max(255)
    .trim()
    .pattern(/^.*\S+.*$/, "non-whitespace")
    .optional()
    .messages({
      "string.pattern.name":
        "Name must contain at least one non-whitespace character",
    }),
  slug: joi
    .string()
    .min(1)
    .max(255)
    .pattern(/^[a-z0-9-]+$/, "url-safe")
    .optional()
    .messages({
      "string.pattern.name":
        "Slug must contain only lowercase letters, numbers, and hyphens",
    }),
  image: joi.string().uri().allow(null).optional(),
  tags: joi.array().items(joi.string()).min(1).optional(),
  ticketmaster_id: joi.string().allow(null).optional(),
  edmtrain_id: joi.number().integer().allow(null).optional(),
  bio: joi.string().max(5000).allow(null).optional(),
  metadata: joi
    .object()
    .max(20)
    .pattern(
      joi.string(),
      joi.any().when(joi.ref("."), {
        is: joi.object(),
        then: joi.object().max(5),
        otherwise: joi.any(),
      })
    )
    .optional()
    .messages({
      "object.max": "Metadata can contain at most 20 top-level keys",
    }),
});

// Event validation schema
const eventSchema = joi.object({
  id: joi.number().required(),
  source: joi.string().valid("edmtrain", "ticketmaster").required(),
  name: joi.string().required(),
  venue: joi.object().required(),
  location_id: joi.number().required(),
  date: joi.string().required(),
  starttime: joi.string().allow(null),
  endtime: joi.string().allow(null),
  link: joi.string().uri().allow(null),
  ages: joi.string().allow(null),
  festivalind: joi.boolean().required(),
  livestreamind: joi.boolean().required(),
  electronicgenreind: joi.boolean().required(),
  othergenreind: joi.boolean().required(),
  artistlist: joi.array().items(joi.object()).required(),
  createddate: joi.string().required(),
});

/**
 * Validate a single partner event object
 *
 * @param event - Raw event data from external API
 * @returns Validated and typed PartnerEvent
 * @throws Error with validation details if event is invalid
 */
const validateEvent = (event: any): PartnerEvent => {
  const { error, value } = eventSchema.validate(event);
  if (error) {
    throw new Error(`Event validation failed: ${error.details[0].message}`);
  }
  return value as PartnerEvent;
};

/**
 * Validate an array of partner events
 *
 * @param events - Array of raw event data from external API
 * @returns Array of validated and typed PartnerEvents
 * @throws Error if input is not an array or any event is invalid
 */
const validateEvents = (events: any[]): PartnerEvent[] => {
  if (!Array.isArray(events)) {
    throw new Error("Events must be an array");
  }

  return events.map(validateEvent);
};

/**
 * Validate artist input for creation
 * Ensures all required fields are present and properly formatted
 *
 * @param input - Raw artist data (from API or external source)
 * @returns Validated and typed ArtistInput
 * @throws Error with validation details if input is invalid
 */
const validateArtistInput = (input: unknown): ArtistInput => {
  const { error, value } = artistInputSchema.validate(input);
  if (error) {
    throw new Error(
      `Artist input validation failed: ${error.details[0].message}`
    );
  }
  return value as ArtistInput;
};

/**
 * Validate partial artist data for updates
 * All fields are optional for flexible data enrichment
 *
 * @param input - Partial artist data for update
 * @returns Validated and typed partial ArtistInput
 * @throws Error with validation details if input has invalid fields
 */
const validateArtistUpdate = (input: unknown): Partial<ArtistInput> => {
  const { error, value } = artistUpdateSchema.validate(input);
  if (error) {
    throw new Error(
      `Artist update validation failed: ${error.details[0].message}`
    );
  }
  return value as Partial<ArtistInput>;
};

export default {
  validateEvent,
  validateEvents,
  validateArtistInput,
  validateArtistUpdate,
};
