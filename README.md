# Nelly

Nelly is a standalone local advisory agent for Wally. She runs through `nelly:latest` on the shared Ollama host, reads a neutral JSON packet from stdin, and writes a validated JSON review to stdout.

Run:

```bash
printf '%s' '{"mode":"independent","evidence":{"fact":"No user evidence exists."}}' | npm run review
```

Nelly never publishes or writes to the Wally repository.

Nelly owns a source-linked personal wiki under `wiki/`. The Wally workflow passes the completed dated conversation to `npm run memory`; Nelly's deterministic updater extracts her recorded position, challenges, recommendation, and open question. It never asks a model to manufacture memory.
