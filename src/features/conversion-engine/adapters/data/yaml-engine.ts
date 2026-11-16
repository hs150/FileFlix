import * as yaml from 'js-yaml';

export function parseYamlToJson(yamlText: string): any {
  return yaml.load(yamlText);
}

export function serializeJsonToYaml(data: any): string {
  return yaml.dump(data, {
    indent: 2,
    noRefs: true,
    forceQuotes: false,
  });
}
