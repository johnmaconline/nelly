# Nelly

Nelly is a standalone local advisory agent for Wally. She runs through `nelly:latest` on the shared Ollama host, reads a neutral JSON packet from stdin, and writes a validated JSON review to stdout.

Run:

```bash
printf '%s' '{"mode":"independent","evidence":{"fact":"No user evidence exists."}}' | npm run review
```

Nelly never publishes or writes to the Wally repository.
