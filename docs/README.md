# r2-mailbox documentation

These pages cover setting up r2-mailbox, reading the mail it stores, and keeping it safe. If you haven’t deployed it yet, start with the setup tutorial. Every other page assumes you’ve finished it.

## Set up r2-mailbox

Follow the tutorial yourself, or hand it to an AI agent. Both take about 15 minutes:

- [Set up your inbox on Cloudflare](getting-started.md): go from a Cloudflare account to a working address, a read-only key, and your first stored email
- [Set up your inbox with an AI agent](setup-with-an-ai-agent.md): paste one prompt into a coding agent and let it run the tutorial, with you handling the browser steps and the secret key

## Use your inbox

These guides each cover one task, for when you’re already set up:

- [Read your mail from the command line](reading-mail.md): list, show, download, and export emails, or use any S3 tool instead of the reader
- [Send your mail to a script or AI agent](agents-and-scripts.md): export mail on a schedule and pass it to your own code without letting an email take control of it
- [Control which emails your inbox accepts and keeps](managing-your-inbox.md): limit senders, require DMARC, forward copies, change retention, rotate the read key, and delete emails
- [Fix setup and delivery problems](troubleshooting.md): find out why an email didn’t show up or why the reader returns an error
- [Change and deploy the code](development.md): type-check, deploy, and watch logs while you work on the Worker or the reader

## Understand the design

This page explains the parts and the reasons behind them:

- [How r2-mailbox works](how-it-works.md): the path an email takes, why nobody can call the Worker from the internet, how emails are stored, and what it costs to run

## Look up details

The reference pages list every command, setting, and field:

- [Reader commands, config, and export format](reference/reader.md)
- [Worker settings, storage format, and setup script options](reference/worker.md)
