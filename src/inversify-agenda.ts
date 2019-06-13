import * as Agenda from 'agenda';
import { Container, decorate, injectable } from 'inversify';

export interface AgendaTaskConfig {
  key: string;
  target: any;
}

export interface AgendaTaskCommand {
  execute(job: Agenda.Job<Agenda.JobAttributesData>): Promise<void>;
}

const tasksDefinitions: AgendaTaskConfig[] = [];
const intervalsDefinitions: { [key: string]: string[]; } = {};

export function AgendaTask(key: string, ...int: (number | string)[]) {
  return (target: any) => {
    decorate(injectable(), target);
    tasksDefinitions.push({ key, target });
    int.forEach(i => {
      intervalsDefinitions[i] = intervalsDefinitions[i] || [];
      intervalsDefinitions[i].push(key);
    });
  };
}

export function defineTaskService(
  container: Container,
  agenda: Agenda,
  key: string,
  target: symbol
) {
  agenda.define(key, async (job: Agenda.Job<Agenda.JobAttributesData>, done: (err?: Error) => void) => {
    try {
      await (container.get(target) as any).execute(job);
      done();
    } catch (err) {
      done(err);
    }
  });
}

export class InversifyAgenda {

  constructor(
    private container: Container,
    private config: {
      agenda?: Agenda,
      db?: {
        address: string,
        collection?: string,
        options?: any
      }
    }
  ) {
    if (this.config.agenda && this.config.db) {
      throw new Error('Cannot use agenda instance and db configuration at the same time');
    }
    if (!this.config.agenda && !this.config.db) {
      throw new Error('Yu have to configure agenda or db connection');
    }
    if (this.config.db) {
      this.config.agenda = new Agenda({
        db: {
          address: this.config.db.address,
          collection: this.config.db.collection,
          options: this.config.db.options
        }
      });
    }
  }

  build() {
    tasksDefinitions.forEach(task => {
      this.container.bind(task.target).toSelf();
      defineTaskService(this.container, this.config.agenda, task.key, task.target);
    });

    this.config.agenda.on('ready', () =>
      Object.keys(intervalsDefinitions).map(interval => this.config.agenda.every(interval, intervalsDefinitions[interval]))
    );
    return this.config.agenda;
  }
}
