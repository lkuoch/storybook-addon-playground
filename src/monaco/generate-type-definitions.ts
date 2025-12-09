import { Documentation, PropDescriptor } from "react-docgen/dist/Documentation";

type ReactDocGenOutput = Record<string, Documentation[]>;
type TsPropDescriptor = PropDescriptor["tsType"];

/**
 * Generates TypeScript declaration file content from react-docgen output
 * This creates .d.ts declarations that Monaco can use for type checking and IntelliSense
 */
export function generateTypeDefinitions(input: ReactDocGenOutput): string {
  const components = Object.values(input).flat();

  if (components.length === 0) {
    return "";
  }

  const declarations: string[] = [];
  const usedTypes = new Set<string>();

  // Add reference to React types (Monaco has React types built-in)
  // declarations.push(`/// <reference types="react" />`);
  declarations.push("");

  // Use declare global to make components available globally
  // This makes the types available without needing to import them
  declarations.push(`declare global {`);

  // Generate prop interfaces and component declarations
  components.forEach(({ displayName, props = {} }) => {
    if (!displayName) {
      return;
    }

    const interfaceName = `${displayName}Props`;
    const propEntries = Object.entries(props);

    // Generate prop interface
    declarations.push(`  interface ${interfaceName} {`);

    if (propEntries.length === 0) {
      declarations.push(`    // No props`);
    } else {
      propEntries.forEach(([propName, propValue]) => {
        const typeStr = convertPropTypeToTypeScript(
          propValue.tsType ?? propValue.type,
          usedTypes
        );
        const isRequired = propValue.required ?? false;
        const description = propValue.description || "";
        const defaultValue = propValue.defaultValue;

        // Generate JSDoc comment
        if (description || defaultValue) {
          declarations.push(`    /**`);
          if (description) {
            declarations.push(`     * ${description.replace(/\n/g, " ")}`);
          }
          if (defaultValue?.value && defaultValue.value !== "undefined") {
            const defaultVal = defaultValue.computed
              ? defaultValue.value
              : JSON.stringify(defaultValue.value);
            declarations.push(`     * @default ${defaultVal}`);
          }
          declarations.push(`     */`);
        }

        // Generate prop declaration
        const optionalMarker = isRequired ? "" : "?";
        // Check if propName is a valid identifier, if not wrap in quotes
        const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
        const formattedPropName = validIdentifierRegex.test(propName)
          ? propName
          : `"${propName}"`;

        declarations.push(
          `    ${formattedPropName}${optionalMarker}: ${typeStr};`
        );
      });
    }

    declarations.push(`  }`);
    declarations.push(``);

    // Generate component declaration as global const
    // Using var instead of const for better global scope compatibility
    const propsType = propEntries.length === 0 ? `{}` : interfaceName;
    declarations.push(`  /**`);
    declarations.push(`   * ${displayName} component`);
    declarations.push(`   */`);
    declarations.push(`  var ${displayName}: React.FC<${propsType}>;`);
    declarations.push(``);
  });

  // Add declarations for used custom types that might be missing
  if (usedTypes.size > 0) {
    usedTypes.forEach((typeName) => {
      // Double check exclusion list
      if (
        ![
          "string",
          "number",
          "boolean",
          "any",
          "void",
          "unknown",
          "null",
          "undefined",
        ].includes(typeName) &&
        !typeName.startsWith("React.") &&
        !typeName.includes("[]") &&
        !typeName.includes("|") &&
        !typeName.includes("&") &&
        !typeName.includes("<")
      ) {
        declarations.splice(2, 0, `  type ${typeName} = any;`);
      }
    });
  }

  declarations.push(`}`);

  // Export the types so they're available
  declarations.push(`export {};`);
  declarations.push("");

  return declarations.join("\n");
}

/**
 * Recursively extracts literal values from union elements, even when they're nested in computed types
 */
function extractLiteralValues(
  element: TsPropDescriptor | PropDescriptor["type"]
): (string | number)[] {
  if (!element) {
    return [];
  }

  // If it's a literal, return its value
  if (element.name === "literal" && "value" in element) {
    return [element.value];
  }

  // If it's a union, recursively extract from its elements
  if (element.name === "union" && "elements" in element && element.elements) {
    return element.elements.flatMap(extractLiteralValues);
  }

  // If it has a raw type that's a computed type (typeof, keyof), skip the raw
  // but check if it has nested elements we can extract from
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
        return element.elements.flatMap(extractLiteralValues);
      }
      // Skip computed types without extractable values
      return [];
    }
  }

  // For other types, try to extract recursively
  if ("elements" in element && element.elements) {
    return element.elements.flatMap(extractLiteralValues);
  }

  return [];
}

/**
 * Converts a react-docgen prop type to TypeScript type string
 */
function convertPropTypeToTypeScript(
  propType: TsPropDescriptor | PropDescriptor["type"],
  usedTypes?: Set<string>
): string {
  if (!propType) {
    return "unknown";
  }

  const typeName = propType.name;

  // Track potential custom types
  if (
    usedTypes &&
    typeName &&
    ![
      "string",
      "number",
      "boolean",
      "any",
      "void",
      "unknown",
      "null",
      "undefined",
      "union",
      "enum",
      "arrayOf",
      "array",
      "object",
      "signature",
      "func",
      "function",
      "instanceOf",
      "literal",
    ].includes(typeName) &&
    !typeName.startsWith("React.") &&
    !typeName.includes("<") &&
    !typeName.includes("[") &&
    !typeName.includes(".") &&
    !typeName.includes("(")
  ) {
    usedTypes.add(typeName);
  }

  // Handle union types first - extract literals even from computed types
  if (typeName === "union" && "elements" in propType && propType.elements) {
    // Try to extract literal values from all elements
    const literals = propType.elements.flatMap(extractLiteralValues);

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

    // If we found literals, format them as a string literal union
    if (uniqueLiterals.length > 0) {
      return uniqueLiterals
        .map((val) =>
          typeof val === "string"
            ? `"${val.replace(/"/g, '\\"')}"`
            : String(val)
        )
        .join(" | ");
    }

    // If no literals found, try to convert elements normally
    const elements = propType.elements
      .map((element) => {
        // For literal elements, extract the value and format as string literal
        if (element.name === "literal" && "value" in element) {
          const val = element.value;
          return typeof val === "string"
            ? `"${val.replace(/"/g, '\\"')}"`
            : String(val);
        }
        // For other elements, convert recursively
        return convertPropTypeToTypeScript(element);
      })
      .filter(Boolean);
    if (elements.length > 0) {
      return elements.join(" | ");
    }

    // Fallback to raw if available
    if ("raw" in propType && propType.raw) {
      return propType.raw.trim();
    }
    return "unknown";
  }

  // For non-union types, check if raw is a computed type
  // If so, try to extract literals from elements instead
  if ("raw" in propType && propType.raw) {
    const raw = propType.raw.trim();
    // If it's a computed type, don't use raw - extract from elements instead
    if (
      raw.includes("typeof") ||
      raw.includes("keyof") ||
      (raw.includes("[") && raw.includes("]"))
    ) {
      // Check if we have elements to extract from
      if ("elements" in propType && propType.elements) {
        const literals = propType.elements.flatMap(extractLiteralValues);
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
          return uniqueLiterals
            .map((val) =>
              typeof val === "string"
                ? `"${val.replace(/"/g, '\\"')}"`
                : String(val)
            )
            .join(" | ");
        }
      }
      // If we can't extract literals, use the raw type (as per user preference)
      return raw;
    }
    // Not a computed type, use raw as-is
    return raw;
  }

  switch (typeName) {
    case "enum":
      if ("value" in propType && propType.value) {
        const values = Array.isArray(propType.value)
          ? propType.value.map((v) => {
              if (typeof v === "object" && "value" in v) {
                const val = v.value;
                // Handle string literals
                if (typeof val === "string") {
                  return `"${val.replace(/"/g, '\\"')}"`;
                }
                return String(val);
              }
              return typeof v === "string" ? `"${v}"` : String(v);
            })
          : [propType.value];
        return values.join(" | ");
      }
      return "unknown";

    case "arrayOf":
      if ("elements" in propType && propType.elements) {
        const elementType = propType.elements[0];
        if (elementType) {
          const innerType = convertPropTypeToTypeScript(elementType);
          return `${innerType}[]`;
        }
      }
      return "unknown[]";

    case "array":
      if ("elements" in propType && propType.elements) {
        const elementType = propType.elements[0];
        if (elementType) {
          const innerType = convertPropTypeToTypeScript(elementType);
          return `${innerType}[]`;
        }
      }
      return "any[]";

    case "object":
      if ("signature" in propType && propType.signature) {
        // Try to use raw if available for object types
        if ("raw" in propType && propType.raw) {
          return propType.raw.trim();
        }
        return "Record<string, any>";
      }
      return "Record<string, any>";

    case "signature":
      if ("raw" in propType && propType.raw) {
        return propType.raw.trim();
      }
      if ("signature" in propType && propType.signature) {
        const sig = propType.signature;
        // Check if it's a function signature (has arguments) or object signature (has properties)
        // Use type assertion with runtime check
        const sigAsAny = sig as {
          arguments?: Array<{
            name: string;
            type?: { raw?: string; name?: string };
          }>;
          return?: { name?: string };
          properties?: unknown;
        };
        if ("arguments" in sigAsAny && Array.isArray(sigAsAny.arguments)) {
          const args =
            sigAsAny.arguments
              ?.map((arg) => {
                const argType = arg.type?.raw || arg.type?.name || "any";
                return `${arg.name}: ${argType}`;
              })
              .join(", ") || "";
          const returnType = sigAsAny.return?.name || "void";
          return `(${args}) => ${returnType}`;
        }
        // Object signature - use raw if available, otherwise return Record type
        if ("raw" in propType && propType.raw) {
          return propType.raw.trim();
        }
        return "Record<string, any>";
      }
      return "() => void";

    case "func":
    case "function":
      if ("raw" in propType && propType.raw) {
        return propType.raw.trim();
      }
      return "() => void";

    case "instanceOf":
      if ("raw" in propType && propType.raw) {
        return propType.raw.trim();
      }
      return "any";

    case "literal":
      if ("value" in propType) {
        const val = propType.value;
        return typeof val === "string" ? `"${val}"` : String(val);
      }
      return "unknown";

    default:
      // For simple types like "string", "number", "boolean", etc.
      // Also handle custom types like "ButtonType", "ButtonColor", etc.
      return typeName || "unknown";
  }
}
