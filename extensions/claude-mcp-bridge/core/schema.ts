import { type Static, type TSchema, Type } from "@sinclair/typebox";

export type AnySchema = TSchema;

export interface JsonSchemaProp {
  type?: string;
  description?: string;
  enum?: unknown[];
  items?: { type?: string };
}

function mapStringType(prop: JsonSchemaProp, opts: Record<string, unknown>): AnySchema {
  if (Array.isArray(prop.enum) && prop.enum.every((v): v is string => typeof v === "string")) {
    return Type.Union(
      prop.enum.map((v) => Type.Literal(v)),
      opts,
    );
  }
  return Type.String(opts);
}

/**
 * Map a single JSON Schema property to the appropriate TypeBox type.
 * Preserves type, description, and enum information so the LLM receives
 * accurate type hints and the framework can validate/coerce values.
 */
export function mapPropertyType(prop: JsonSchemaProp): AnySchema {
  const opts: Record<string, unknown> = {};
  if (typeof prop.description === "string") opts.description = prop.description;

  switch (prop.type) {
    case "string":
      return mapStringType(prop, opts);
    case "boolean":
      return Type.Boolean(opts);
    case "number":
      return Type.Number(opts);
    case "integer":
      return Type.Integer(opts);
    case "array":
      return Type.Array(Type.Any(), opts);
    default:
      return Type.Any(opts);
  }
}

export function createParameterSchema(inputSchema: Record<string, unknown>): TSchema {
  const schema = inputSchema as {
    type?: string;
    properties?: Record<string, JsonSchemaProp>;
    required?: string[];
  };

  if (schema.type !== "object" || !schema.properties) {
    return Type.Object({});
  }

  const required = new Set(schema.required ?? []);
  const properties: Record<string, AnySchema> = {};

  for (const [key, prop] of Object.entries(schema.properties)) {
    const base = mapPropertyType(prop);

    if (required.has(key)) {
      properties[key] = base;
    } else {
      properties[key] = Type.Optional(base);
    }
  }

  return Type.Object(properties, { additionalProperties: true });
}

export type ToolParams = Static<ReturnType<typeof createParameterSchema>>;
