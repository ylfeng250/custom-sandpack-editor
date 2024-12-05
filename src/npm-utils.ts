import { inflate } from 'pako';
import * as Babel from '@babel/standalone';

declare module '@babel/standalone' {
  export const traverse: (
    ast: any,
    visitor: {
      ImportDeclaration?: (path: { node: { source: { value: string } } }) => void;
      CallExpression?: (path: {
        node: {
          callee: { type: string; name: string };
          arguments: any[];
        };
      }) => void;
    }
  ) => void;
}

interface TarHeader {
  name: string;
  size: number;
  type: string;
}

function parseTarHeader(buffer: Uint8Array, offset: number): TarHeader | null {
  if (offset + 512 > buffer.length) return null;

  const name = new TextDecoder().decode(buffer.slice(offset, offset + 100)).replace(/\0.*$/, '');
  const size = parseInt(new TextDecoder().decode(buffer.slice(offset + 124, offset + 136)).trim(), 8);
  const type = String.fromCharCode(buffer[offset + 156]);

  return { name, size, type };
}

export async function extractTarball(buffer: ArrayBuffer): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  
  try {
    let tarData: Uint8Array;
    try {
      tarData = inflate(new Uint8Array(buffer));
    } catch {
      tarData = new Uint8Array(buffer);
    }

    let offset = 0;
    while (offset < tarData.length) {
      const header = parseTarHeader(tarData, offset);
      if (!header) break;
      
      offset += 512;

      if (header.type === '0' || header.type === '\0') { 
        if (header.size > 0) {
          const content = new TextDecoder().decode(tarData.slice(offset, offset + header.size));
          const path = header.name.replace(/^package\//, '');
          files.set(path, content);
        }
        offset += Math.ceil(header.size / 512) * 512;
      } else {
        offset += Math.ceil(header.size / 512) * 512;
      }
    }
  } catch (error) {
    console.error("Error extracting tarball:", error);
  }

  return files;
}

export function analyzeDependencies(code: string): string[] {
  const dependencies: string[] = [];

  if (code.length > 1000000) { 
    console.warn('File too large for dependency analysis (>1MB). Skipping.');
    return dependencies;
  }

  try {
    const ast = Babel.transform(code, {
      ast: true,
      plugins: ['syntax-jsx', 'syntax-typescript'],
      filename: 'virtual.tsx',
      compact: true,
      comments: false,
      parserOpts: {
        strictMode: false,
        allowReturnOutsideFunction: true,
        allowSuperOutsideMethod: true
      }
    }).ast;

    Babel.traverse(ast, {
      ImportDeclaration(path: { node: { source: { value: string } } }) {
        const source = path.node.source.value;
        if (!source.startsWith('.') && !source.startsWith('/')) {
          dependencies.push(source);
        }
      },
      CallExpression(path: {
        node: {
          callee: { type: string; name: string };
          arguments: any[];
        };
      }) {
        if (
          path.node.callee.type === 'Identifier' &&
          path.node.callee.name === 'require' &&
          path.node.arguments.length === 1 &&
          path.node.arguments[0].type === 'StringLiteral'
        ) {
          const source = path.node.arguments[0].value;
          if (!source.startsWith('.') && !source.startsWith('/')) {
            dependencies.push(source);
          }
        }
      },
    });
  } catch (error) {
    console.warn('Failed to parse file for dependencies:', error);
  }

  return [...new Set(dependencies)];
}
