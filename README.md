
https://www.npmjs.com/package/inversify-agenda

Some utilities for the development of [agenda](https://github.com/agenda/agenda) workers with Inversify.

## Installation

You can install `inversify-agenda` using npm:

```sh
npm i inversify inversify-agenda reflect-metadata --save
```

The `inversify-agenda` type definitions are included in the npm module and require TypeScript 3.
Please refer to the [InversifyJS documentation](https://github.com/inversify/InversifyJS#installation) to learn more about the installation process.

## The pre-requisites

First of all you need to be familiar with [agenda](https://github.com/agenda/agenda)

## Quick start guide

### Step 1: Decorate task classes.

All the task will be performed by command classes. It needs to implement `AgendaTaskCommand` interface. And will be decorated by `@task`.
`@task` decorator has 2 parameters, `jobName` and array of `interval`.

```typescript
@task('task.sms.searchAndSend', '10 seconds')
export class TasTest implements AgendaTaskCommand {

  constructor(
    private service: Service // will be injected by inversify
  ) { }

  execute(job: Agenda.Job<Agenda.JobAttributesData>): Promise<void> {
    // do it what you want.
    // dont need to worry about call done() callback, the result of the job will be the same as the Promise in the response
  }

}
```

### Step 1: Configuration

You can configure `inversify-agenda` using a mongodb connection or passing an instance of `Agenda`.

Using `mongodb`
```typescript
// or whatever way you have to get your inversify container.
import { container } from './inversify.config';

const agenda = new InversifyAgenda(container, {
    db: {
    address: process.env.MONGO_URL,
    options: {
            useNewUrlParser: true
            // other options
        }
    }
}).build();
agenda.start();
```

Or passing an already created `Agenda` instance
```typescript
// or whatever way you have to get your inversify container.
import { container } from './inversify.config';
const agenda = new Agenda({
    db: {
        address: this.config.db.address,
        collection: this.config.db.collection,
        options: this.config.db.options
    }
});
const agenda = new InversifyAgenda(container, { agenda }).build();
agenda.start();
```

## Next steps

1. Refactor in several files
2. Change `@task` decorator to be full compatible with `agenda.define` and `agenda.every`. Including priority, time zone, concurrency etc. 

## Collaboration

This proyect is widely open to collaborators, please feel free to raise an issue or create a pull request. 
