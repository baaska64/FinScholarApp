import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import ts from 'typescript';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react-native') {
    const mockPath = path.resolve(process.cwd(), 'scripts/mocks/react-native.js');
    return {
      shortCircuit: true,
      url: pathToFileURL(mockPath).href,
    };
  }
  if (specifier === 'react-native-android-widget') {
    const mockPath = path.resolve(process.cwd(), 'scripts/mocks/react-native-android-widget.js');
    return {
      shortCircuit: true,
      url: pathToFileURL(mockPath).href,
    };
  }
  if (specifier === '@react-native-async-storage/async-storage') {
    const mockPath = path.resolve(process.cwd(), 'scripts/mocks/async-storage.js');
    return {
      shortCircuit: true,
      url: pathToFileURL(mockPath).href,
    };
  }
  if (specifier === '@react-native-google-signin/google-signin') {
    const mockPath = path.resolve(process.cwd(), 'scripts/mocks/google-signin.js');
    return {
      shortCircuit: true,
      url: pathToFileURL(mockPath).href,
    };
  }
  if (specifier === 'expo-router') {
    const mockPath = path.resolve(process.cwd(), 'scripts/mocks/expo-router.js');
    return {
      shortCircuit: true,
      url: pathToFileURL(mockPath).href,
    };
  }
  if (specifier === 'expo-constants') {
    const mockPath = path.resolve(process.cwd(), 'scripts/mocks/expo-constants.js');
    return {
      shortCircuit: true,
      url: pathToFileURL(mockPath).href,
    };
  }
  if (specifier.startsWith('@/')) {
    const relativePath = specifier.slice(2);
    let fullPath = path.resolve(process.cwd(), relativePath);
    if (!fs.existsSync(fullPath) && fs.existsSync(fullPath + '.tsx')) {
      fullPath += '.tsx';
    } else if (!fs.existsSync(fullPath) && fs.existsSync(fullPath + '.ts')) {
      fullPath += '.ts';
    } else if (!fs.existsSync(fullPath) && fs.existsSync(fullPath + '.js')) {
      fullPath += '.js';
    }
    return nextResolve(pathToFileURL(fullPath).href, context);
  }
  if ((specifier.startsWith('.') || specifier.startsWith('/')) && context.parentURL) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    let fullPath = path.resolve(parentDir, specifier);
    if (!fs.existsSync(fullPath)) {
      if (fs.existsSync(fullPath + '.tsx')) {
        fullPath += '.tsx';
      } else if (fs.existsSync(fullPath + '.ts')) {
        fullPath += '.ts';
      } else if (fs.existsSync(fullPath + '.js')) {
        fullPath += '.js';
      }
    }
    return nextResolve(pathToFileURL(fullPath).href, context);
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const filePath = fileURLToPath(url);
    const source = fs.readFileSync(filePath, 'utf8');
    const jsxOption = ts.JsxEmit ? ts.JsxEmit.React : 1;
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: jsxOption,
      },
    });
    return {
      format: 'module',
      shortCircuit: true,
      source: output.outputText,
    };
  }
  return nextLoad(url, context);
}
