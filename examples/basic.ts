import { ArgParser } from '@arge/arg-parser/args';

const parser = new ArgParser();
parser.addOption('format', {
  abbr: 'f',
  allowed: ['text', 'json'],
  defaultsTo: 'text',
  help: 'Output format',
});
parser.addFlag('verbose', { abbr: 'v' });
parser.addMultiOption('include', { abbr: 'I' });

const results = parser.parse(['--format', 'json', '-v', '--include', 'src,lib', 'input.txt']);
console.log(JSON.stringify({
  format: results.option('format'),
  verbose: results.flag('verbose'),
  include: results.multiOption('include'),
  rest: results.rest,
}));
