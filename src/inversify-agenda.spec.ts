import 'reflect-metadata';
import { AgendaTaskCommand, task, inversifyAgendaTasksConfiguration } from './inversify-agenda';

describe('AgendaTask', () => {

    @task('test', ['10 minutes', '20 minutes', '30 minutes'])
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

    @task('test22', '20 minutes', { concurrency: 1 })
    class TestCommand22 implements AgendaTaskCommand {
        async execute() {
            console.log('DO NOTHING');
        }
    }

    it('should invoke decorate class with @inject() add task definition and interval definition', () => {
        expect(inversifyAgendaTasksConfiguration.tasks.find(t => t.key === 'test')).toEqual({
            key: 'test',
            target: TestCommand,
            options: undefined,
            focus: undefined
        });
        expect(inversifyAgendaTasksConfiguration.tasks.find(t => t.key === 'test2')).toEqual({
            key: 'test2',
            target: TestCommand2,
            options: undefined,
            focus: undefined
        });
        expect(inversifyAgendaTasksConfiguration.tasks.find(t => t.key === 'test22')).toEqual({
            key: 'test22',
            target: TestCommand22,
            options: { concurrency: 1 },
            focus: undefined
        });
        expect(inversifyAgendaTasksConfiguration.intervals['10 minutes']).toEqual([{ key: 'test' }]);
        expect(inversifyAgendaTasksConfiguration.intervals['20 minutes']).toEqual([{ key: 'test' }, { key: 'test2' }, { key: 'test22' }]);
        expect(inversifyAgendaTasksConfiguration.intervals['30 minutes']).toEqual([{ key: 'test' }]);
    });
});