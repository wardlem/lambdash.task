var _ = require('lambdash');
var Result = require('./TaskResult');

Task = _.Type.product('Task', {exec: _.Fun});

var run = process && _.Fun.member(process.nextTick)
    ? process.nextTick
    : setTimeout;

Task.isRejected = Result.isRejected;
Task.isResolved = Result.isResolved;
Task.rejecteds = Result.rejecteds;
Task.resolveds = Result.resolveds;

Task.reject = Result.Rejected;
Task.resolve = Result.Resolved;

Task.Result = Result;

Task.of = _.curry(function(value){
    return Task(function(complete){
        complete(Result.of(value));
    });
});

Task.ofRejected = _.curry(function(value){
    return Task(function(complete){
        complete(Result.ofRejected(value));
    });
});

Task.map = _.curry(function(fn, task){
    return Task(function(complete){
        task.exec(function(result){
            complete(Result.map(fn, result));
        });
    });
});

Task.concatSeries = _.curry(function(left, right){
    return Task(function(complete){
        left.exec(function(l){
            if (Result.isRejected(l)) {
                complete(l);
            } else {
                right.exec(function(r){
                    complete(Result.concat(l,r));
                });
            }
        });
    });
});

Task.concatParallel = _.curry(function(left, right) {
    return Task(function(complete){
        var l;
        var r;

        left.exec(function(result){
            l = result;
            if (r) {
                complete(Result.concat(l, r));
            }
        });

        right.exec(function(result){
            r = result;
            if (l) {
                complete(Result.concat(l, r));
            }
        })

    });
});


Task.concat = Task.concatSeries;

Task.series = _.curry(function(tasks) {
    var M = _.Type.moduleFor(tasks);

    if (_.isEmpty(tasks)) {
        // cannot do anything with an empty list of tasks
        return Task.of(M.empty());
    }

    return _.foldr(function(accum, task){
        return Task.concatSeries(Task.map(M.of, task), accum);
    }, Task.of(M.empty()), tasks);
});

Task.parallel = _.curry(function(tasks) {
    var M = _.Type.moduleFor(tasks);

    if (_.isEmpty(tasks)) {
        // cannot do anything with an empty list of tasks
        return Task.of(M.empty());
    }

    return _.foldr(function(accum, task){
        return Task.concatParallel(Task.map(M.of, task), accum);
    }, Task.of(M.empty()), tasks);
});

Task.partition = _.curry(function(tasks) {
    var M = _.Type.moduleFor(tasks);
    var l = _.length(tasks);

    if (l === 0) {
        // cannot do anything with an empty list of tasks
        return Task.of(_.concat(M.of(M.empty()), M.of(M.empty())));
    }

    var completed = 0;
    var resolveds = M.empty();
    var rejects = M.empty();
    return Task(function(complete){
        return _.foldr(function(accum, task){
            task.exec(function(result){
                if (Result.isRejected(result)) {
                    rejects = _.append(result.value, rejects);
                } else {
                    resolveds = _.append(result.value, resolveds);
                }
                completed += 1;
                if (completed === l) {
                    complete(Result.of(_.concat(M.of(rejects), M.of(resolveds))));
                }
            });
        }, null, tasks);
    });

});

Task.ap = _.curry(function(apply, task) {
    return Task(function(complete) {
        apply.exec(function(fnResult){
            if (Result.isRejected(fnResult)) {
                complete(fnResult);
            } else {
                task.exec(function(result){
                    complete(Result.ap(fnResult, result));
                })
            }
        });
    });
});

Task.flatten = _.curry(function(task) {
    return Task(function(complete){
        task.exec(function(result){
            if (Result.isRejected(result)) {
                complete(result);
                return;
            }
            result.value.exec(complete);
        });
    });
});

Task.chain = _.curry(function(fn, task){
    return Task(function(complete){
        task.exec(function(result){
            result = Result.map(fn, result);
            if (Task.isRejected(result)){
                complete(result);
                return;
            }
            result.value.exec(complete);
        });
    });
});

Task.exec = _.curry(function(fn, task){
    task.exec(fn);
});

Task.fork = _.curry(function(rejected, resolved, task){
    task.exec(Result.case({
        Rejected: rejected,
        Resolved: resolved
    }));
});

Task.bimap = _.curry(function(rejected, resolved, task){
    return Task(function(complete){
        complete(Task.fork(rejected, resolved, task));
    });
});

Task.fromCallback = function(err, result){
    return err == null ? Task.of(result) : Task.ofRejected(result);
};

Task.show = _.always('Task');

module.exports = Task;
