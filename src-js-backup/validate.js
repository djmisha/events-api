// TODO - Add validation for event objects - currently not implemented

const joi = require("joi");

const eventSchema = joi.object({
  id: joi.string().required(),
  source: joi.string().valid("edmtrain", "ticketmaster").required(),
  name: joi.string().required(),
  venue: joi.string().required(),
  city: joi.string().required(),
  date: joi.date().iso().required(),
  url: joi.string().uri().allow(null),
  genre: joi.array().items(joi.string()),
  inserted_at: joi.date().iso().required(),
});

const validateEvent = (event) => {
  const { error, value } = eventSchema.validate(event);
  if (error) {
    throw new Error(`Event validation failed: ${error.details[0].message}`);
  }
  return value;
};

const validateEvents = (events) => {
  if (!Array.isArray(events)) {
    throw new Error("Events must be an array");
  }

  return events.map(validateEvent);
};

module.exports = {
  validateEvent,
  validateEvents,
};
