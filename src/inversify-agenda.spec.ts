import 'reflect-metadata';
import { InversifyAgenda, AgendaTaskCommand, task, inversifyAgendaTasksConfiguration } from './inversify-agenda';
import { Container } from 'inversify';
import * as Agenda from 'agenda';

describe('defineTaskService', () => {

    class TestCommand implements AgendaTaskCommand {
        async execute() {
            console.log('DO NOTHING');
        }
    }

    it('should define agenda task with target command injected with inversify', () => {
        const container: Container = {
            get<T>(serviceIdentifier: any) {
                return new TestCommand();
            }
        } as Container;
        let func: (job: Agenda.Job<any>, done: (err?: Error) => void) => void;
        const agenda: Agenda = {
            define<T>(name: string, handler: (job: Agenda.Job<T>, done: (err?: Error) => void) => void) {
                console.log('MOCK');
                func = handler;
            }
        } as Agenda;
        spyOn(agenda, 'define').and.callThrough();
        spyOn(container, 'get').and.callThrough();
        InversifyAgenda.defineTaskService(
            container,
            agenda,
            'test',
            TestCommand as any
        );
        expect(agenda.define).toHaveBeenCalledWith('test', jasmine.any(Function));
        func.call(this, {}, (err?: Error) => console.log('DONE', err));
        expect(container.get).toHaveBeenCalledWith(TestCommand);
    })
});

describe('AgendaTask', () => {
    
    @task('test', '10 minutes')
    class TestCommand implements AgendaTaskCommand {
        async execute() {
            console.log('DO NOTHING');
        }
    }

    @task('test2', '20 minutes')
    class TestCommand2 implements AgendaTaskCommand {
        async execute() {
            console.log('DO NOTHING');
        }
    }

    @task('test22', '20 minutes')
    class TestCommand22 implements AgendaTaskCommand {
        async execute() {
            console.log('DO NOTHING');
        }
    }

    it('should invoke decorate class with @inject() add task definition and interval definition', () => {
        expect(inversifyAgendaTasksConfiguration.tasks.find(t => t.key === 'test')).toEqual({
            key: 'test',
            target: TestCommand
        });
        expect(inversifyAgendaTasksConfiguration.tasks.find(t => t.key === 'test2')).toEqual({
            key: 'test2',
            target: TestCommand2
        });
        expect(inversifyAgendaTasksConfiguration.tasks.find(t => t.key === 'test22')).toEqual({
            key: 'test22',
            target: TestCommand22
        });
        expect(inversifyAgendaTasksConfiguration.intervals['10 minutes']).toEqual(['test']);
        expect(inversifyAgendaTasksConfiguration.intervals['20 minutes']).toEqual(['test2', 'test22']);
    });
});