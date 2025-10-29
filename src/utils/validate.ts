import joi from "joi";
import { PartnerEvent } from "../types";

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

const validateEvent = (event: any): PartnerEvent => {
  const { error, value } = eventSchema.validate(event);
  if (error) {
    throw new Error(`Event validation failed: ${error.details[0].message}`);
  }
  return value as PartnerEvent;
};

const validateEvents = (events: any[]): PartnerEvent[] => {
  if (!Array.isArray(events)) {
    throw new Error("Events must be an array");
  }

  return events.map(validateEvent);
};

export default {
  validateEvent,
  validateEvents,
};
