var fs = require('fs');
var jasmine = require('jasmine-node');
var lodash = require('lodash');
var runtimeerror = require("../lib/runtimeerror");
var strftime = require('strftime');
var today = strftime.strftime('%b %d', new Date());
var noop = function() { };
var nothing = null;

describe("runtimeerror", function() {
  beforeEach(function() {
    // reset runtimeerror.duplicates counter
    lodash.forEach(runtimeerror.duplicates, function(index, key) { delete runtimeerror.duplicates[key]; });
  });
  describe("make_generic_title", function() {
    it("should change digits to {N}", function() {
      expect(runtimeerror.make_generic_title("1,23-456abc7890.12 345")).toBe("{N},{N}-{HEX}.{N} {N}");
    });
    it("should change hexadecimals to {HEX}", function() {
      expect(runtimeerror.make_generic_title("1,23-0x1234567.12 345")).toBe("{N},{N}-{HEX}.{N} {N}");
      expect(runtimeerror.make_generic_title("access_token=215046.933a290.9d09819574bb4e46cd648303&count=777")).toBe('access_token={N}.{HEX}.{HEX}&count={N}');
    });
    it("should remove email subject prefixes - fw:, fwd:, re:", function() {
      expect(runtimeerror.make_generic_title("fw: hello world there")).toBe("hello world there");
      expect(runtimeerror.make_generic_title("re: hello world there")).toBe("hello world there");
      expect(runtimeerror.make_generic_title("fwd: hello world there")).toBe("hello world there");
      expect(runtimeerror.make_generic_title("re: fwd: hello world there")).toBe("hello world there");
      expect(runtimeerror.make_generic_title("fwd: fw: hello world there")).toBe("hello world there");
    });
    it("should fail gracefully with undefined/null", function() {
      expect(runtimeerror.make_generic_title()).toBe("");
      expect(runtimeerror.make_generic_title(null)).toBe("");
      expect(runtimeerror.make_generic_title(false)).toBe("");
    })
  });
  describe("json2htmltables", function() {
    it("should show table for key values", function() {
      var json = { key1: "val<u>e1", key2: "value2" }
      expect(runtimeerror.json2htmltables(json)).toBe('<table><tr><th align="left">key1</th><td align="left">val&lt;u&gt;e1</td></tr><tr><th align="left">key2</th><td align="left">value2</td></tr></table>');
    });
    it("should show key as header if value is hash", function() {
      var json = { key1: "value1", key2: {
        sub1: "v1", sub2: "v2"
      }, key3: "value3" }
      expect(runtimeerror.json2htmltables(json)).toBe('<table><tr><th align="left">key1</th><td align="left">value1</td></tr></table><h4>key2</h4><table><tr><th align="left">sub1</th><td align="left">v1</td></tr><tr><th align="left">sub2</th><td align="left">v2</td></tr></table><table><tr><th align="left">key3</th><td align="left">value3</td></tr></table>');
    })
    it("should show values as rows (without keys) if value is array", function() {
      var json = { key1: "value1", key2: ["one1", "two2", "three3"], key3: "value3" }
      expect(runtimeerror.json2htmltables(json)).toBe('<table><tr><th align="left">key1</th><td align="left">value1</td></tr></table><h4>key2</h4>\n<pre>\none1\ntwo2\nthree3\n</pre>\n<table><tr><th align="left">key3</th><td align="left">value3</td></tr></table>');
    })
  });
  describe("sparkline_url", function() {
    var url_prefix = process.env.SPARKLINE_URL || "http://sparklines-bitworking.appspot.com/spark.cgi?type=impulse&height=40&upper={MAX}&above-color=red&below-color=gray&width=5&limits={MIN},{MAX}&d={RAW}";
    var dates = lodash.map([6, 5, 4, 3, 2, 1, 0], function(n) { return strftime.strftime('%b %d', new Date(new Date() - 3600000*24*n)); });
    var date_count_array = [];
    var values = [];
    lodash.each(dates, function(date, index) {
      if (Math.random() > 0.5) return values.push(0);
      var v = parseInt(Math.random() * 10);
      values.push(v);
      date_count_array.push(date);
      date_count_array.push(v);
    });
    it("should generate correct url to image", function() {
      expect(runtimeerror.sparkline_url(date_count_array)).toBe(
        url_prefix.replace(/\{([^{}]*)\}/g, function (a, b) {
          if (b == 'MIN') return "0";
          if (b == 'MAX') return lodash.max(values);
          if (b == 'RAW') return values.join(',');
        })
      );
    });
  });
  describe("update_body_suffix", function() {
    var oneday = 3600000*24;
    it("should append suffix [today, 1]", function() {
      var meta = { runtimeerror: [today, 1]};
      var img_url = runtimeerror.sparkline_url(meta.runtimeerror);
      var json = JSON.stringify(meta);
      var img = "<img src='" + img_url + "' alt='" + json + "' title='" + json + "'/>";
      expect(runtimeerror.update_body_suffix('hello')).toBe('hello<br/>\n' + img);
    });
    it("should modify suffix if exist", function() {
      var meta = { runtimeerror: [today, 100]};
      var img_url = runtimeerror.sparkline_url(meta.runtimeerror);
      var json = JSON.stringify(meta);
      var img = "<img src='" + img_url + "' alt='" + json + "' title='" + json + "'/>";
      expect(runtimeerror.update_body_suffix('hello<br/>\n{"runtimeerror": ["' + today + '",99]}')).toBe('hello<br/>\n' + img);
    });
    it("should keep old date & counts if exist", function() {
      var yesterday = strftime.strftime('%b %d', new Date(new Date() - oneday));
      var ancient  = strftime.strftime('%b %d', new Date(new Date() - oneday*7));
      var meta = { runtimeerror: [yesterday, 99, today, 1]};
      var img_url = runtimeerror.sparkline_url(meta.runtimeerror);
      var json = JSON.stringify(meta);
      var img = "<img src='" + img_url + "' alt='" + json + "' title='" + json + "'/>";
      expect(runtimeerror.update_body_suffix('hello<br/>\n{"runtimeerror": ["' + ancient + '",88,"' + yesterday + '",99]}')).toBe('hello<br/>\n' + img);
    });
    it("should be able to parse <img/> tag and extract json from title", function() {
      var yesterday = strftime.strftime('%b %d', new Date(new Date() - oneday));
      var meta = { runtimeerror: [yesterday, 99, today, 1]};
      var img_url = runtimeerror.sparkline_url(meta.runtimeerror);
      var json = JSON.stringify(meta);
      var img = "<img src='" + img_url + "' alt='" + json + "' title='" + json + "'/>";

      var meta2 = { runtimeerror: [yesterday, 99, today, 2]};
      var img_url2 = runtimeerror.sparkline_url(meta2.runtimeerror);
      var json2 = JSON.stringify(meta2);
      var img2 = "<img src='" + img_url2 + "' alt='" + json2 + "' title='" + json2 + "'/>";
      expect(runtimeerror.update_body_suffix('hello<br/>\n'+img)).toBe('hello<br/>\n'+img2);
    })
  });
  describe("extract_repo_secret_provider(email_address)", function() {
    it("should return object with attributes: repo, secret, provider", function() {
      var result = runtimeerror.extract_repo_secret_provider('"hello/world.js" <abc.def@smtp.random.com>');
      expect(JSON.stringify(result)).toBe(JSON.stringify({ repo: 'hello/world.js', secret: 'abc.def', provider: 'smtp' }));
    });
    it("should use swap out secret with ENV value if available", function() {
      process.env['abc.def_SECRET'] = 'XYZ123';
      var result = runtimeerror.extract_repo_secret_provider('"hello/world.js" <abc.def@smtp.random.com>');
      expect(JSON.stringify(result)).toBe(JSON.stringify({ repo: 'hello/world.js', secret: 'XYZ123', provider: 'smtp' }));
      delete process.env['abc.def_SECRET'];
    });
    it("should pluck label via user+label@host format", function() {
      var result = runtimeerror.extract_repo_secret_provider('"hello/world.js" <abc.def+mylabel123+456@smtp.random.com>');
      expect(JSON.stringify(result)).toBe(JSON.stringify({ repo: 'hello/world.js', secret: 'abc.def', label: 'mylabel123 456', provider: 'smtp' }));
    });
    it("should return null with invalid email", function() {
      expect(runtimeerror.extract_repo_secret_provider('hello')).toBe(undefined);
      expect(runtimeerror.extract_repo_secret_provider(null)).toBe(undefined);
      expect(runtimeerror.extract_repo_secret_provider()).toBe(undefined);
    });
  });
  describe("extract_repo_number_provider_secret(message_id)", function() {
    it("should return object with attributes: repo, number, provider, secret", function() {
      // <{repo}/issues/{number}@{provider}.{secret}.random>
      var result = runtimeerror.extract_repo_number_provider_secret('<hello/world/issues/42@none.abc.def.1391541483184>');
      expect(JSON.stringify(result)).toBe(JSON.stringify({ repo: 'hello/world', number: '42', provider: 'none', secret: 'abc.def' }));
    });
    it("should return null with invalid message_id", function() {
      expect(runtimeerror.extract_repo_number_provider_secret('hello@world.com')).toBe(undefined);
      expect(runtimeerror.extract_repo_number_provider_secret('hello')).toBe(undefined);
      expect(runtimeerror.extract_repo_number_provider_secret(null)).toBe(undefined);
      expect(runtimeerror.extract_repo_number_provider_secret()).toBe(undefined);
    });
  });
  describe("skip_duplicate", function() {
    var title = "hello";
    var accountA1 = runtimeerror.find_or_create_account({ repo: 'repoA', secret: 'secretA', provider: 'none' });
    var accountA2 = runtimeerror.find_or_create_account({ repo: 'repoA', secret: 'secretA', provider: 'none' });
    var keyA = runtimeerror.duplicates_key(accountA1, title);
    var accountB  = runtimeerror.find_or_create_account({ repo: 'repoA', secret: 'secretB', provider: 'none' });
    var keyB = runtimeerror.duplicates_key(accountB, title);
    it("should increment counter for same account info and generic title", function() {
      runtimeerror.skip_duplicate(accountA1, title);
      expect(runtimeerror.duplicates[keyA]).toBe(1);
      expect(runtimeerror.duplicates[keyB]).toBe(undefined);
      runtimeerror.skip_duplicate(accountA2, title);
      expect(runtimeerror.duplicates[keyA]).toBe(2);
      expect(runtimeerror.duplicates[keyB]).toBe(undefined);
      runtimeerror.skip_duplicate(accountB, title);
      expect(runtimeerror.duplicates[keyA]).toBe(2);
      expect(runtimeerror.duplicates[keyB]).toBe(1);
    });
    it("should return true ONLY when counter <=1", function() {
      expect(runtimeerror.skip_duplicate(accountA1, title)).toBe(false);
      expect(runtimeerror.skip_duplicate(accountA1, title)).toBe(true);
      expect(runtimeerror.skip_duplicate(accountA2, title)).toBe(true);
      expect(runtimeerror.skip_duplicate(accountB, title)).toBe(false);
      expect(runtimeerror.skip_duplicate(accountB, title)).toBe(true);
    });
  })
  describe("instance", function() {
    var account = runtimeerror.find_or_create_account({ repo: 'repoA', secret: 'secretB', provider: 'none' });
    describe("find_or_create_account(repo, secret, provider)", function() {
      it("should create new instance of provider.Provider", function() {
        expect(account.repo).toBe('repoA');
        expect(account.secret).toBe('secretB');
        expect(account.provider).toBe('none');
      });
      it("should reuse existing instance", function() {
        expect(runtimeerror.find_or_create_account({ repo: 'repoA', secret: 'secretB', provider: 'none' })).toBe(account);
      });
    });
    describe("handle(account, title, body)", function() {
      it("should call account.find_issue_by_title", function() {
        spyOn(account, 'find_issue_by_title').andCallFake(function(title, callback) { });
        runtimeerror.handle(account, "titleA", "bodyB", noop);
        expect(account.find_issue_by_title).toHaveBeenCalledWith("titleA", jasmine.any(Function));
      });
      it("should call account.make_generic_title", function() {
        spyOn(runtimeerror, 'make_generic_title').andCallFake(function(title) { });
        runtimeerror.handle(account, "titleA", "bodyB", noop);
        expect(runtimeerror.make_generic_title).toHaveBeenCalledWith("titleA");
      });
      it("should call account.update_body_suffix", function() {
        spyOn(runtimeerror, 'update_body_suffix').andCallFake(function(body) { });
        runtimeerror.handle(account, "titleA", "bodyB", noop);
        expect(runtimeerror.update_body_suffix).toHaveBeenCalledWith("bodyB", 1);
      });
      describe("multiple times", function() {
        it("should call account.find_issue_by_title ONCE", function() {
          var invoked_find_issue_by_title = 0;
          spyOn(account, 'find_issue_by_title').andCallFake(function(title, callback) { invoked_find_issue_by_title++; });
          runtimeerror.handle(account, "titleA", "bodyB", noop);
          runtimeerror.handle(account, "titleA", "bodyB", noop);
          runtimeerror.handle(account, "titleA", "bodyB", noop);
          runtimeerror.handle(account, "titleA", "bodyB", noop);
          expect(account.find_issue_by_title).toHaveBeenCalledWith("titleA", jasmine.any(Function));
          expect(invoked_find_issue_by_title).toBe(1);
        });
      });
      describe("find_issue_by_title yield nothing", function() {
        var called_find_issue_by_title;
        beforeEach(function() {
          called_find_issue_by_title = false;
          spyOn(account, 'find_issue_by_title').andCallFake(function(title, callback) {
            process.nextTick(function() {
              called_find_issue_by_title = true;
              callback();
            });
          });
        });
        it("should call account.create_issue", function() {
          spyOn(account, 'create_issue').andCallFake(function(attrs, callback) { })
          runs(function() {
            runtimeerror.handle(account, "titleA", "bodyB", noop);
          })
          waitsFor(function() {
            if (called_find_issue_by_title) {
              var meta = { runtimeerror: [today, 1]};
              var img_url = runtimeerror.sparkline_url(meta.runtimeerror);
              var json = JSON.stringify(meta);
              var img = "<img src='" + img_url + "' alt='" + json + "' title='" + json + "'/>";
              expect(account.create_issue).toHaveBeenCalledWith({ title: "titleA", body: "bodyB<br/>\n"+img }, jasmine.any(Function));
            }
            return called_find_issue_by_title;
          });
        });
        it("should create_issue with HTML wrapper removed from body", function() {
          spyOn(account, 'create_issue').andCallFake(function(attrs, callback) { })
          runs(function() {
            runtimeerror.handle(account, "titleA", "<HTML>\n<head>\n</head>\n<body>bodyB</body>\n</HTML>", noop);
          });
          waitsFor(function() {
            if (called_find_issue_by_title) {
              var meta = { runtimeerror: [today, 1]};
              var img_url = runtimeerror.sparkline_url(meta.runtimeerror);
              var json = JSON.stringify(meta);
              var img = "<img src='" + img_url + "' alt='" + json + "' title='" + json + "'/>";
              expect(account.create_issue).toHaveBeenCalledWith({ title: "titleA", body: "<body>bodyB</body><br/>\n"+img }, jasmine.any(Function));
            }
            return called_find_issue_by_title;
          });
        });
        it("should +{duplicate count} when multiple calls were detected, and reset duplicate counter immediately", function() {
          spyOn(account, 'create_issue').andCallFake(function(attrs, callback) { })
          runs(function() {
            runtimeerror.handle(account, "titleA", "bodyB", noop);
            runtimeerror.handle(account, "titleA", "bodyB", noop);
            runtimeerror.handle(account, "titleA", "bodyB", noop);
          });
          waitsFor(function() {
            if (called_find_issue_by_title) {
              expect(runtimeerror.duplicates[runtimeerror.duplicates_key(account, "titleA")]).toBe(undefined); // should have resetted duplicate counter
              var meta = { runtimeerror: [today, 3]};
              var img_url = runtimeerror.sparkline_url(meta.runtimeerror);
              var json = JSON.stringify(meta);
              var img = "<img src='" + img_url + "' alt='" + json + "' title='" + json + "'/>";
              expect(account.create_issue).toHaveBeenCalledWith({ title: "titleA", body: "bodyB<br/>\n"+img }, jasmine.any(Function));
            }
            return called_find_issue_by_title;
          });
        });
      });

      var something = { number: "123", title: "hey", body: "you" };
      describe("find_issue_by_title yield {open}", function() {
        beforeEach(function() {
          spyOn(account, 'find_issue_by_title').andCallFake(function(title, callback) { callback(nothing, something); });
          spyOn(account, 'reopen_issue').andCallFake(function(uid, attrs, callback) { callback(nothing, something); });
          spyOn(account, 'update_issue').andCallFake(function(uid, attrs, callback) { callback(nothing, something); });
          spyOn(account.api, 'is_closed').andCallFake(function() { return false; });
        });
        it("should call account.update_issue ONLY", function() {
          runtimeerror.handle(account, "titleA", "bodyB", noop);
          expect(account.find_issue_by_title).toHaveBeenCalled();
          expect(account.update_issue)       .toHaveBeenCalledWith(account.uid_for(something), something, jasmine.any(Function));
          expect(account.reopen_issue)       .not.toHaveBeenCalled();
        });
        it("should abort (when wontfix)", function() {
          spyOn(account.api, 'is_wontfix').andCallFake(function() { return true; });
          runtimeerror.handle(account, "titleA", "bodyB", noop);
          expect(account.find_issue_by_title).toHaveBeenCalled();
          expect(account.update_issue)       .toHaveBeenCalled();
          expect(account.reopen_issue)       .not.toHaveBeenCalled();
        })
      });

      describe("find_issue_by_title yield {closed}", function() {
        beforeEach(function() {
          spyOn(account, 'find_issue_by_title').andCallFake(function(title, callback) { callback(nothing, something); });
          spyOn(account, 'reopen_issue').andCallFake(function(uid, attrs, callback) { callback(nothing, something); });
          spyOn(account, 'update_issue').andCallFake(function(uid, attrs, callback) { callback(nothing, something); });
          spyOn(account.api, 'is_closed').andCallFake(function() { return true; });
        });
        it("should call account.reopen", function() {
          var meta = { runtimeerror: [today, 1]};
          var img_url = runtimeerror.sparkline_url(meta.runtimeerror);
          var json = JSON.stringify(meta);
          var img = "<img src='" + img_url + "' alt='" + json + "' title='" + json + "'/>";
          runtimeerror.handle(account, "titleA", "bodyB", noop);
          expect(account.find_issue_by_title).toHaveBeenCalled();
          expect(account.reopen_issue)       .toHaveBeenCalledWith(account.uid_for(something), { title: "titleA", body: "bodyB<br/>\n"+img }, jasmine.any(Function));
          expect(account.update_issue)       .not.toHaveBeenCalled();
        });
        it("should reopen_issue with HTML wrapper removed from body", function() {
          var meta = { runtimeerror: [today, 1]};
          var img_url = runtimeerror.sparkline_url(meta.runtimeerror);
          var json = JSON.stringify(meta);
          var img = "<img src='" + img_url + "' alt='" + json + "' title='" + json + "'/>";
          runtimeerror.handle(account, "titleA", "<HTML>\n<head>\n</head>\n<body>bodyB</body>\n</HTML>", noop);
          expect(account.reopen_issue)      .toHaveBeenCalledWith(account.uid_for(something), { title: "titleA", body: "<body>bodyB</body><br/>\n"+img }, jasmine.any(Function));
        });
        it("should abort (when wontfix)", function() {
          spyOn(account.api, 'is_wontfix').andCallFake(function() { return true; });
          runtimeerror.handle(account, "titleA", "bodyB", noop);
          expect(account.find_issue_by_title).toHaveBeenCalled();
          expect(account.reopen_issue)       .not.toHaveBeenCalled();
          expect(account.update_issue)       .toHaveBeenCalled();
        });
      });

      describe("with email", function() {
        var email = 'verified@email.com';
        beforeEach(function() {
          spyOn(account.api, "my_email").andCallFake(function(fn) { fn(null, email); });
        });
        it('should deliver email to account.api.me', function() {
          var bool = false;
          spyOn(account, 'find_issue_by_title').andCallFake(function(title, callback) { process.nextTick(function() { callback(null, null); }); });
          spyOn(account, 'create_issue').andCallFake(function(attrs, callback) { process.nextTick(function() { callback(null, {
            "number": 42,
            "state": "open",
            "url": "https://api.github.com/repos/octocat/Hello-World/issues/1347"
          }); }); });
          spyOn(runtimeerror, 'notify').andCallFake(function() { bool = true; });
          runs(function() {
            runtimeerror.handle(account, "titleA", "bodyB", noop);
          })
          waitsFor(function() {
            return bool;
          });
        });
      })
    });
    describe('notify', function() {
      var attrs = {
        "url": "https://api.github.com/repos/octocat/Hello-World/issues/1347",
        "html_url": "https://github.com/octocat/Hello-World/issues/1347",
        "number": 1347,
        "title": "Found a bug",
        "body": "I'm having a problem with this.",
        "user": {
          "login": "octocat",
        }
      };
      var email = 'verified@email.com';
      it('should smtp.send', function() {
        var bool = false;
        var transport = { sendMail: noop };
        spyOn(transport, 'sendMail').andCallFake(function(opts, fn) {
          expect(opts.to).toBe(email);
          bool = true;
          fn();
        });
        spyOn(account.api, "my_email").andCallFake(function(fn) { fn(null, email); });
        spyOn(runtimeerror, "email_transport").andCallFake(function() { return transport; });
        runtimeerror.notify(account, attrs, noop);
        waitsFor(function() {
          return bool;
        });
      });
    });
  });
});
