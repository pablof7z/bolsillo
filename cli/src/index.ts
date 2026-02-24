#!/usr/bin/env node

import 'websocket-polyfill';
import { Command } from 'commander';
import { createCommand } from './commands/create.js';
import { fetchCommand } from './commands/fetch.js';
import { updateCommand } from './commands/update.js';

const program = new Command();

program
	.name('bolsillo')
	.description('CLI tool for NIP-C1 collaborative events on Nostr')
	.version('0.1.0')
	.option('--nsec <nsec>', 'Nostr private key (nsec1…)');

program.addCommand(createCommand);
program.addCommand(fetchCommand);
program.addCommand(updateCommand);

program.parse();
