import {
  DefaultValueDescriptor,
  Documentation,
  PropDescriptor,
} from "react-docgen/dist/Documentation";
const excludedProps = ["children", "data-testid", "dataTestId", "id"];

type ReactDocGenOutput = Record<string, Documentation[]>;
type PropEntry = [string, PropDescriptor];
type TsPropDescriptor = PropDescriptor["tsType"];
type JsPropDescriptor = PropDescriptor["type"];

export function generateAutocompletion(input: ReactDocGenOutput) {
  return Object.values(input)
    .flat()
    .reduce((acc, { displayName, props = {} }) => {
      return {
        ...acc,
        [displayName]: Object.entries(props).filter(filterProps).map(mapProps),
      };
    }, {});
}

function filterProps([propName]: PropEntry): boolean {
  return !excludedProps.includes(propName);
}

function mapProps([propName, propValue]: PropEntry) {
  const {
    tsType,
    type: jsType,
    required = false,
    description = "",
    defaultValue,
  } = propValue;

  // Prefer tsType over jsType, and check for raw field first
  const propType = tsType ?? jsType;
  let parsedType = parseType(propType);

  // If we have a raw type string and parsedType is an array, check if raw is better
  if (propType && "raw" in propType && propType.raw) {
    const raw = propType.raw.trim();
    // If raw contains a union with string literals, prefer it
    if (raw.includes("|") && raw.match(/["']/)) {
      // Extract literals from raw to ensure we have the correct values
      const rawLiterals = raw
        .split("|")
        .map((part) => {
          const trimmed = part.trim();
          const match = trimmed.match(/^(["'])([^"']+)\1$/);
          return match ? match[2] : null;
        })
        .filter((v): v is string => v !== null);

      // If we got literals from raw and they differ from parsed, use raw literals
      if (rawLiterals.length > 0) {
        // Check if parsedType is an array with different values
        if (Array.isArray(parsedType)) {
          const parsedValues = parsedType.map(String);
          // If values differ, prefer raw (more accurate)
          if (
            JSON.stringify(parsedValues.sort()) !==
            JSON.stringify(rawLiterals.sort())
          ) {
            parsedType = rawLiterals;
          }
        } else {
          // parsedType is not an array, use raw literals
          parsedType = rawLiterals;
        }
      }
    }
  }

  return {
    [propName]: {
      type: parsedType,
      required,
      defaultValue: parseDefaultValue(defaultValue),
      description,
    },
  };
}

function parseType(propType: JsPropDescriptor | TsPropDescriptor): unknown {
  if (!propType) {
    return "unknown";
  }

  // Prefer raw type if available (most accurate for unions like 'small' | 'medium' | 'large')
  // But skip if it's a computed type - we'll extract literals from elements instead
  if ("raw" in propType && propType.raw) {
    const raw = propType.raw.trim();

    // If it's a computed type (typeof, keyof), don't use raw - extract from elements instead
    if (
      raw.includes("typeof") ||
      raw.includes("keyof") ||
      (raw.includes("[") && raw.includes("]"))
    ) {
      // Skip raw for computed types, will fall through to parse elements
    } else if (raw.includes("|")) {
      // Extract string literals from union: 'small' | 'medium' | 'large'
      const literals = raw
        .split("|")
        .map((part) => {
          const trimmed = part.trim();
          // Match quoted strings: 'value' or "value"
          const match = trimmed.match(/^(["'])([^"']+)\1$/);
          if (match) {
            return match[2]; // Return the unquoted value
          }
          return null;
        })
        .filter((v): v is string => v !== null);
      if (literals.length > 0) {
        return literals;
      }
      // If no literals found but it's a union, return raw
      return raw.replace(/\n/g, "");
    } else {
      // Not a union, return raw as-is
      return raw.replace(/\n/g, "");
    }
  }

  switch (propType.name) {
    case "enum":
      if ("value" in propType && propType.value) {
        return Array.isArray(propType.value)
          ? propType.value.map((v) =>
              typeof v === "object" && "value" in v
                ? v.value.replace(/"/g, "")
                : ""
            )
          : propType.value;
      }
      break;
    case "literal":
      // Handle literal types - extract the actual value
      if ("value" in propType && propType.value !== undefined) {
        return propType.value;
      }
      // Fall through to default if no value
      break;
    case "union":
    case "arrayOf":
      if ("elements" in propType && propType.elements) {
        // Recursively extract all literal values from union elements
        const extractLiterals = (
          element: JsPropDescriptor | TsPropDescriptor
        ): (string | number)[] => {
          // If it's a literal, return its value
          if (element.name === "literal" && "value" in element) {
            return [element.value];
          }

          // If it's a union, recursively extract from its elements
          if (
            element.name === "union" &&
            "elements" in element &&
            element.elements
          ) {
            return element.elements.flatMap(extractLiterals);
          }

          // If it has a raw type that's a computed type (typeof, keyof), skip it
          // but check if it has nested elements
          if ("raw" in element && element.raw) {
            const raw = element.raw;
            // If it's a computed type, try to extract from nested elements if available
            if (
              raw.includes("typeof") ||
              raw.includes("keyof") ||
              (raw.includes("[") && raw.includes("]"))
            ) {
              // Check if there are nested elements we can extract from
              if ("elements" in element && element.elements) {
                return element.elements.flatMap(extractLiterals);
              }
              // Skip computed types without extractable values
              return [];
            }
          }

          // For other types, try to parse recursively
          const parsed = parseType(element);
          if (Array.isArray(parsed)) {
            return parsed.filter(
              (v): v is string | number =>
                typeof v === "string" || typeof v === "number"
            );
          }
          // If it's a string that looks like a type name, skip it
          if (typeof parsed === "string") {
            const str = parsed;
            if (
              str.includes("typeof") ||
              str.includes("keyof") ||
              str.includes("[") ||
              str.includes("]") ||
              str.length > 50
            ) {
              return [];
            }
            // If it's a simple type name, skip it
            if (
              [
                "string",
                "number",
                "boolean",
                "object",
                "array",
                "function",
                "unknown",
              ].includes(str.toLowerCase())
            ) {
              return [];
            }
          }
          return [];
        };

        const literals = propType.elements.flatMap(extractLiterals);

        // Filter out duplicates and invalid values
        const uniqueLiterals = Array.from(
          new Set(
            literals.filter(
              (v): v is string | number =>
                v !== null &&
                v !== undefined &&
                (typeof v === "string" || typeof v === "number")
            )
          )
        );

        if (uniqueLiterals.length > 0) {
          // For unions, return array of all literal values
          // For arrayOf, wrap in array syntax
          return propType.name === "arrayOf"
            ? uniqueLiterals.map((el) => `${el}[]`)
            : uniqueLiterals;
        }
      }
      break;
    default: {
      const raw = (propType as JsPropDescriptor).raw;
      return raw ? raw.replace(/\n/g, "") : propType.name || "unknown";
    }
  }
}

function parseDefaultValue(defaultValue: DefaultValueDescriptor) {
  if (
    !defaultValue?.value ||
    ["null", "undefined"].includes(defaultValue?.value as string)
  ) {
    return;
  }
  return defaultValue.value;
}
