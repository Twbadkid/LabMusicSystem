/**
 * An Angular module that gives you access to the browsers local storage
 * @version v0.5.2 - 2016-09-28
 * @link https://github.com/grevory/angular-local-storage
 * @author grevory <greg@gregpike.ca>
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
(function (window, angular) {
var isDefined = angular.isDefined,
  isUndefined = angular.isUndefined,
  isNumber = angular.isNumber,
  isObject = angular.isObject,
  isArray = angular.isArray,
  isString = angular.isString,
  extend = angular.extend,
  toJson = angular.toJson;

angular
  .module('LocalStorageModule', [])
  .provider('localStorageService', function() {
    // You should set a prefix to avoid overwriting any local storage variables from the rest of your app
    // e.g. localStorageServiceProvider.setPrefix('yourAppName');
    // With provider you can use config as this:
    // myApp.config(function (localStorageServiceProvider) {
    //    localStorageServiceProvider.prefix = 'yourAppName';
    // });
    this.prefix = 'ls';

    // You could change web storage type localstorage or sessionStorage
    this.storageType = 'localStorage';

    // Cookie options (usually in case of fallback)
    // expiry = Number of days before cookies expire // 0 = Does not expire
    // path = The web path the cookie represents
    // secure = Wether the cookies should be secure (i.e only sent on HTTPS requests)
    this.cookie = {
      expiry: 30,
      path: '/',
      secure: false
    };

    // Decides wether we should default to cookies if localstorage is not supported.
    this.defaultToCookie = true;

    // Send signals for each of the following actions?
    this.notify = {
      setItem: true,
      removeItem: false
    };

    // Setter for the prefix
    this.setPrefix = function(prefix) {
      this.prefix = prefix;
      return this;
    };

    // Setter for the storageType
    this.setStorageType = function(storageType) {
      this.storageType = storageType;
      return this;
    };
    // Setter for defaultToCookie value, default is true.
    this.setDefaultToCookie = function (shouldDefault) {
      this.defaultToCookie = !!shouldDefault; // Double-not to make sure it's a bool value.
      return this;
    };
    // Setter for cookie config
    this.setStorageCookie = function(exp, path, secure) {
      this.cookie.expiry = exp;
      this.cookie.path = path;
      this.cookie.secure = secure;
      return this;
    };

    // Setter for cookie domain
    this.setStorageCookieDomain = function(domain) {
      this.cookie.domain = domain;
      return this;
    };

    // Setter for notification config
    // itemSet & itemRemove should be booleans
    this.setNotify = function(itemSet, itemRemove) {
      this.notify = {
        setItem: itemSet,
        removeItem: itemRemove
      };
      return this;
    };

    this.$get = ['$rootScope', '$window', '$document', '$parse','$timeout', function($rootScope, $window, $document, $parse, $timeout) {
      var self = this;
      var prefix = self.prefix;
      var cookie = self.cookie;
      var notify = self.notify;
      var storageType = self.storageType;
      var webStorage;

      // When Angular's $document is not available
      if (!$document) {
        $document = document;
      } else if ($document[0]) {
        $document = $document[0];
      }

      // If there is a prefix set in the config lets use that with an appended period for readability
      if (prefix.substr(-1) !== '.') {
        prefix = !!prefix ? prefix + '.' : '';
      }
      var deriveQualifiedKey = function(key) {
        return prefix + key;
      };

      // Removes prefix from the key.
      var underiveQualifiedKey = function (key) {
        return key.replace(new RegExp('^' + prefix, 'g'), '');
      };

      // Check if the key is within our prefix namespace.
      var isKeyPrefixOurs = function (key) {
        return key.indexOf(prefix) === 0;
      };

      // Checks the browser to see if local storage is supported
      var checkSupport = function () {
        try {
          var supported = (storageType in $window && $window[storageType] !== null);

          // When Safari (OS X or iOS) is in private browsing mode, it appears as though localStorage
          // is available, but trying to call .setItem throws an exception.
          //
          // "QUOTA_EXCEEDED_ERR: DOM Exception 22: An attempt was made to add something to storage
          // that exceeded the quota."
          var key = deriveQualifiedKey('__' + Math.round(Math.random() * 1e7));
          if (supported) {
            webStorage = $window[storageType];
            webStorage.setItem(key, '');
            webStorage.removeItem(key);
          }

          return supported;
        } catch (e) {
          // Only change storageType to cookies if defaulting is enabled.
          if (self.defaultToCookie)
            storageType = 'cookie';
          $rootScope.$broadcast('LocalStorageModule.notification.error', e.message);
          return false;
        }
      };
      var browserSupportsLocalStorage = checkSupport();

      // Directly adds a value to local storage
      // If local storage is not available in the browser use cookies
      // Example use: localStorageService.add('library','angular');
      var addToLocalStorage = function (key, value, type) {
        setStorageType(type);

        // Let's convert undefined values to null to get the value consistent
        if (isUndefined(value)) {
          value = null;
        } else {
          value = toJson(value);
        }

        // If this browser does not support local storage use cookies
        if (!browserSupportsLocalStorage && self.defaultToCookie || self.storageType === 'cookie') {
          if (!browserSupportsLocalStorage) {
            $rootScope.$broadcast('LocalStorageModule.notification.warning', 'LOCAL_STORAGE_NOT_SUPPORTED');
          }

          if (notify.setItem) {
            $rootScope.$broadcast('LocalStorageModule.notification.setitem', {key: key, newvalue: value, storageType: 'cookie'});
          }
          return addToCookies(key, value);
        }

        try {
          if (webStorage) {
            webStorage.setItem(deriveQualifiedKey(key), value);
          }
          if (notify.setItem) {
            $rootScope.$broadcast('LocalStorageModule.notification.setitem', {key: key, newvalue: value, storageType: self.storageType});
          }
        } catch (e) {
          $rootScope.$broadcast('LocalStorageModule.notification.error', e.message);
          return addToCookies(key, value);
        }
        return true;
      };

      // Directly get a value from local storage
      // Example use: localStorageService.get('library'); // returns 'angular'
      var getFromLocalStorage = function (key, type) {
        setStorageType(type);

        if (!browserSupportsLocalStorage && self.defaultToCookie  || self.storageType === 'cookie') {
          if (!browserSupportsLocalStorage) {
            $rootScope.$broadcast('LocalStorageModule.notification.warning', 'LOCAL_STORAGE_NOT_SUPPORTED');
          }

          return getFromCookies(key);
        }

        var item = webStorage ? webStorage.getItem(deriveQualifiedKey(key)) : null;
        // angular.toJson will convert null to 'null', so a proper conversion is needed
        // FIXME not a perfect solution, since a valid 'null' string can't be stored
        if (!item || item === 'null') {
          return null;
        }

        try {
          return JSON.parse(item);
        } catch (e) {
          return item;
        }
      };

      // Remove an item from local storage
      // Example use: localStorageService.remove('library'); // removes the key/value pair of library='angular'
      //
      // This is var-arg removal, check the last argument to see if it is a storageType
      // and set type accordingly before removing.
      //
      var removeFromLocalStorage = function () {
        // can't pop on arguments, so we do this
        var consumed = 0;
        if (arguments.length >= 1 &&
            (arguments[arguments.length - 1] === 'localStorage' ||
             arguments[arguments.length - 1] === 'sessionStorage')) {
          consumed = 1;
          setStorageType(arguments[arguments.length - 1]);
        }

        var i, key;
        for (i = 0; i < arguments.length - consumed; i++) {
          key = arguments[i];
          if (!browserSupportsLocalStorage && self.defaultToCookie || self.storageType === 'cookie') {
            if (!browserSupportsLocalStorage) {
              $rootScope.$broadcast('LocalStorageModule.notification.warning', 'LOCAL_STORAGE_NOT_SUPPORTED');
            }

            if (notify.removeItem) {
              $rootScope.$broadcast('LocalStorageModule.notification.removeitem', {key: key, storageType: 'cookie'});
            }
            removeFromCookies(key);
          }
          else {
            try {
              webStorage.removeItem(deriveQualifiedKey(key));
              if (notify.removeItem) {
                $rootScope.$broadcast('LocalStorageModule.notification.removeitem', {
                  key: key,
                  storageType: self.storageType
                });
              }
            } catch (e) {
              $rootScope.$broadcast('LocalStorageModule.notification.error', e.message);
              removeFromCookies(key);
            }
          }
        }
      };

      // Return array of keys for local storage
      // Example use: var keys = localStorageService.keys()
      var getKeysForLocalStorage = function (type) {
        setStorageType(type);

        if (!browserSupportsLocalStorage) {
          $rootScope.$broadcast('LocalStorageModule.notification.warning', 'LOCAL_STORAGE_NOT_SUPPORTED');
          return [];
        }

        var prefixLength = prefix.length;
        var keys = [];
        for (var key in webStorage) {
          // Only return keys that are for this app
          if (key.substr(0, prefixLength) === prefix) {
            try {
              keys.push(key.substr(prefixLength));
            } catch (e) {
              $rootScope.$broadcast('LocalStorageModule.notification.error', e.Description);
              return [];
            }
          }
        }
        return keys;
      };

      // Remove all data for this app from local storage
      // Also optionally takes a regular expression string and removes the matching key-value pairs
      // Example use: localStorageService.clearAll();
      // Should be used mostly for development purposes
      var clearAllFromLocalStorage = function (regularExpression, type) {
        setStorageType(type);

        // Setting both regular expressions independently
        // Empty strings result in catchall RegExp
        var prefixRegex = !!prefix ? new RegExp('^' + prefix) : new RegExp();
        var testRegex = !!regularExpression ? new RegExp(regularExpression) : new RegExp();

        if (!browserSupportsLocalStorage && self.defaultToCookie  || self.storageType === 'cookie') {
          if (!browserSupportsLocalStorage) {
            $rootScope.$broadcast('LocalStorageModule.notification.warning', 'LOCAL_STORAGE_NOT_SUPPORTED');
          }
          return clearAllFromCookies();
        }
        if (!browserSupportsLocalStorage && !self.defaultToCookie)
          return false;
        var prefixLength = prefix.length;

        for (var key in webStorage) {
          // Only remove items that are for this app and match the regular expression
          if (prefixRegex.test(key) && testRegex.test(key.substr(prefixLength))) {
            try {
              removeFromLocalStorage(key.substr(prefixLength));
            } catch (e) {
              $rootScope.$broadcast('LocalStorageModule.notification.error', e.message);
              return clearAllFromCookies();
            }
          }
        }
        return true;
      };

      // Checks the browser to see if cookies are supported
      var browserSupportsCookies = (function() {
        try {
          return $window.navigator.cookieEnabled ||
          ("cookie" in $document && ($document.cookie.length > 0 ||
            ($document.cookie = "test").indexOf.call($document.cookie, "test") > -1));
          } catch (e) {
            $rootScope.$broadcast('LocalStorageModule.notification.error', e.message);
            return false;
          }
        }());

        // Directly adds a value to cookies
        // Typically used as a fallback if local storage is not available in the browser
        // Example use: localStorageService.cookie.add('library','angular');
        var addToCookies = function (key, value, daysToExpiry, secure) {

          if (isUndefined(value)) {
            return false;
          } else if(isArray(value) || isObject(value)) {
            value = toJson(value);
          }

          if (!browserSupportsCookies) {
            $rootScope.$broadcast('LocalStorageModule.notification.error', 'COOKIES_NOT_SUPPORTED');
            return false;
          }

          try {
            var expiry = '',
            expiryDate = new Date(),
            cookieDomain = '';

            if (value === null) {
              // Mark that the cookie has expired one day ago
              expiryDate.setTime(expiryDate.getTime() + (-1 * 24 * 60 * 60 * 1000));
              expiry = "; expires=" + expiryDate.toGMTString();
              value = '';
            } else if (isNumber(daysToExpiry) && daysToExpiry !== 0) {
              expiryDate.setTime(expiryDate.getTime() + (daysToExpiry * 24 * 60 * 60 * 1000));
              expiry = "; expires=" + expiryDate.toGMTString();
            } else if (cookie.expiry !== 0) {
              expiryDate.setTime(expiryDate.getTime() + (cookie.expiry * 24 * 60 * 60 * 1000));
              expiry = "; expires=" + expiryDate.toGMTString();
            }
            if (!!key) {
              var cookiePath = "; path=" + cookie.path;
              if (cookie.domain) {
                cookieDomain = "; domain=" + cookie.domain;
              }
              /* Providing the secure parameter always takes precedence over config
               * (allows developer to mix and match secure + non-secure) */
              if (typeof secure === 'boolean') {
                  if (secure === true) {
                      /* We've explicitly specified secure,
                       * add the secure attribute to the cookie (after domain) */
                      cookieDomain += "; secure";
                  }
                  // else - secure has been supplied but isn't true - so don't set secure flag, regardless of what config says
              }
              else if (cookie.secure === true) {
                  // secure parameter wasn't specified, get default from config
                  cookieDomain += "; secure";
              }
              $document.cookie = deriveQualifiedKey(key) + "=" + encodeURIComponent(value) + expiry + cookiePath + cookieDomain;
            }
          } catch (e) {
            $rootScope.$broadcast('LocalStorageModule.notification.error', e.message);
            return false;
          }
          return true;
        };

        // Directly get a value from a cookie
        // Example use: localStorageService.cookie.get('library'); // returns 'angular'
        var getFromCookies = function (key) {
          if (!browserSupportsCookies) {
            $rootScope.$broadcast('LocalStorageModule.notification.error', 'COOKIES_NOT_SUPPORTED');
            return false;
          }

          var cookies = $document.cookie && $document.cookie.split(';') || [];
          for(var i=0; i < cookies.length; i++) {
            var thisCookie = cookies[i];
            while (thisCookie.charAt(0) === ' ') {
              thisCookie = thisCookie.substring(1,thisCookie.length);
            }
            if (thisCookie.indexOf(deriveQualifiedKey(key) + '=') === 0) {
              var storedValues = decodeURIComponent(thisCookie.substring(prefix.length + key.length + 1, thisCookie.length));
              try {
                var parsedValue = JSON.parse(storedValues);
                return typeof(parsedValue) === 'number' ? storedValues : parsedValue;
              } catch(e) {
                return storedValues;
              }
            }
          }
          return null;
        };

        var removeFromCookies = function (key) {
          addToCookies(key,null);
        };

        var clearAllFromCookies = function () {
          var thisCookie = null;
          var prefixLength = prefix.length;
          var cookies = $document.cookie.split(';');
          for(var i = 0; i < cookies.length; i++) {
            thisCookie = cookies[i];

            while (thisCookie.charAt(0) === ' ') {
              thisCookie = thisCookie.substring(1, thisCookie.length);
            }

            var key = thisCookie.substring(prefixLength, thisCookie.indexOf('='));
            removeFromCookies(key);
          }
        };

        var getStorageType = function() {
          return storageType;
        };

        var setStorageType = function(type) {
          if (type && storageType !== type) {
            storageType = type;
            browserSupportsLocalStorage = checkSupport();
          }
          return browserSupportsLocalStorage;
        };

        // Add a listener on scope variable to save its changes to local storage
        // Return a function which when called cancels binding
        var bindToScope = function(scope, key, def, lsKey, type) {
          lsKey = lsKey || key;
          var value = getFromLocalStorage(lsKey, type);

          if (value === null && isDefined(def)) {
            value = def;
          } else if (isObject(value) && isObject(def)) {
            value = extend(value, def);
          }

          $parse(key).assign(scope, value);

          return scope.$watch(key, function(newVal) {
            addToLocalStorage(lsKey, newVal, type);
          }, isObject(scope[key]));
        };

        // Add listener to local storage, for update callbacks.
        if (browserSupportsLocalStorage) {
            if ($window.addEventListener) {
                $window.addEventListener("storage", handleStorageChangeCallback, false);
                $rootScope.$on('$destroy', function() {
                    $window.removeEventListener("storage", handleStorageChangeCallback);
                });
            } else if($window.attachEvent){
                // attachEvent and detachEvent are proprietary to IE v6-10
                $window.attachEvent("onstorage", handleStorageChangeCallback);
                $rootScope.$on('$destroy', function() {
                    $window.detachEvent("onstorage", handleStorageChangeCallback);
                });
            }
        }

        // Callback handler for storage changed.
        function handleStorageChangeCallback(e) {
            if (!e) { e = $window.event; }
            if (notify.setItem) {
                if (isString(e.key) && isKeyPrefixOurs(e.key)) {
                    var key = underiveQualifiedKey(e.key);
                    // Use timeout, to avoid using $rootScope.$apply.
                    $timeout(function () {
                        $rootScope.$broadcast('LocalStorageModule.notification.changed', { key: key, newvalue: e.newValue, storageType: self.storageType });
                    });
                }
            }
        }

        // Return localStorageService.length
        // ignore keys that not owned
        var lengthOfLocalStorage = function(type) {
          setStorageType(type);

          var count = 0;
          var storage = $window[storageType];
          for(var i = 0; i < storage.length; i++) {
            if(storage.key(i).indexOf(prefix) === 0 ) {
              count++;
            }
          }
          return count;
        };

        return {
          isSupported: browserSupportsLocalStorage,
          getStorageType: getStorageType,
          setStorageType: setStorageType,
          set: addToLocalStorage,
          add: addToLocalStorage, //DEPRECATED
          get: getFromLocalStorage,
          keys: getKeysForLocalStorage,
          remove: removeFromLocalStorage,
          clearAll: clearAllFromLocalStorage,
          bind: bindToScope,
          deriveKey: deriveQualifiedKey,
          underiveKey: underiveQualifiedKey,
          length: lengthOfLocalStorage,
          defaultToCookie: this.defaultToCookie,
          cookie: {
            isSupported: browserSupportsCookies,
            set: addToCookies,
            add: addToCookies, //DEPRECATED
            get: getFromCookies,
            remove: removeFromCookies,
            clearAll: clearAllFromCookies
          }
        };
      }];
  });
})(window, window.angular);
(function() {
	'use strict';

	angular
		.module('angular-marquee', [])
		.directive('angularMarquee', angularMarquee);

	function angularMarquee($timeout) {
		return {
			restrict: 'A',
			scope: true,
			compile: function(tElement, tAttrs) {
				if (tElement.children().length === 0) {
					tElement.append('<div>' + tElement.text() + '</div>');
				}
				var content = tElement.children();
      	var $element = $(tElement);
				$(tElement).empty();
				tElement.append('<div class="angular-marquee" style="float:left;">' + content.clone()[0].outerHTML + '</div>');
        var $item = $element.find('.angular-marquee');
        $item.clone().css('display','none').appendTo($element);
				$element.wrapInner('<div style="width:100000px" class="angular-marquee-wrapper"></div>');
					return {
						post: function(scope, element, attrs) {
							//direction, duration,
							var $element = $(element);
							var $item = $element.find('.angular-marquee:first');
							var $marquee = $element.find('.angular-marquee-wrapper');
							var $cloneItem = $element.find('.angular-marquee:last');
							var duplicated = false;

							var containerWidth = parseInt($element.width());
							var itemWidth = parseInt($item.width());
							var defaultOffset = 20;
							var duration = 3000;
							var scroll = false;
							var animationCssName = '';

							function calculateWidthAndHeight() {
								containerWidth = parseInt($element.width());
								itemWidth = parseInt($item.width());
								if (itemWidth > containerWidth) {
									duplicated = true;
								} else {
									duplicated = false;
								}

								if (duplicated) {
								$cloneItem.show();
								} else {
									$cloneItem.hide();
								}

								$element.height($item.height());
							}

							function _objToString(obj) {
								var tabjson = [];
								for (var p in obj) {
										if (obj.hasOwnProperty(p)) {
												tabjson.push(p + ':' + obj[p]);
										}
								}
								tabjson.push();
								return '{' + tabjson.join(',') + '}';
							};

							function calculateAnimationDuration(newDuration) {
								var result = (itemWidth + containerWidth) / containerWidth * newDuration / 1000;
								if (duplicated) {
									result = result / 2;
								}
								return result;
							}

							function getAnimationPrefix() {
								var elm = document.body || document.createElement('div');
								var domPrefixes = ['webkit', 'moz','O','ms','Khtml'];

								for (var i = 0; i < domPrefixes.length; i++) {
									if (elm.style[domPrefixes[i] + 'AnimationName'] !== undefined) {
										var prefix = domPrefixes[i].toLowerCase();
										return prefix;
									}
								}
							}

							function createKeyframe(number) {
								var prefix = getAnimationPrefix();

								var margin = itemWidth;
								// if (duplicated) {
								// 	margin = itemWidth
								// } else {
								// 	margin = itemWidth + containerWidth;
								// }
								var keyframeString = '@-' + prefix + '-keyframes ' + 'simpleMarquee' + number;
								var css = {
									'margin-left': - (margin) +'px'
								}
								var keyframeCss = keyframeString + '{ 100%' + _objToString(css) + '}';
								var $styles = $('style');

								//Now add the keyframe animation to the head
								if ($styles.length !== 0) {
										//Bug fixed for jQuery 1.3.x - Instead of using .last(), use following
										$styles.filter(":last").append(keyframeCss);
								} else {
										$('head').append('<style>' + keyframeCss + '</style>');
								}
							}

							function stopAnimation() {
								$marquee.css('margin-left',0);
								if (animationCssName != '') {
									$marquee.css(animationCssName, '');
								}

							}


							function createAnimationCss(number) {
								var time = calculateAnimationDuration(duration);
								var prefix = getAnimationPrefix();
								animationCssName = '-' + prefix +'-animation';
								var cssValue = 'simpleMarquee' + number + ' ' + time + 's 0s linear infinite';
								$marquee.css(animationCssName, cssValue);
								if (duplicated) {
									$marquee.css('margin-left', 0);
								} else {
									var margin = containerWidth + defaultOffset;
									$marquee.css('margin-left', margin);
								}
							}

							function animate() {
								//create css style
								//create keyframe
								calculateWidthAndHeight();
								var number = Math.floor(Math.random() * 1000000);
								createKeyframe(number);
								createAnimationCss(number);
							}

							scope.$watch(attrs.scroll, function(scrollAttrValue) {
								scroll = scrollAttrValue;
								recalculateMarquee();
							});

							function recalculateMarquee() {
								if (scroll) {
									animate();
								} else {
									stopAnimation();
								}
							}

							var timer;
							scope.$on('recalculateMarquee', function(event, data) {
								console.log('receive recalculateMarquee event');
								if (timer) {
									$timeout.cancel(timer);
								}
								timer = $timeout(function() {
									recalculateMarquee();
								}, 500);

							});

							scope.$watch(attrs.duration, function(durationText) {
								duration = parseInt(durationText);
								if (scroll) {
									animate();
								}
							});
						}
					}
				}
			};
	}

})();
/* global YT */
angular.module('youtube-embed', [])
.service ('youtubeEmbedUtils', ['$window', '$rootScope', function ($window, $rootScope) {
    var Service = {}

    // adapted from http://stackoverflow.com/a/5831191/1614967
    var youtubeRegexp = /https?:\/\/(?:[0-9A-Z-]+\.)?(?:youtu\.be\/|youtube(?:-nocookie)?\.com\S*[^\w\s-])([\w-]{11})(?=[^\w-]|$)(?![?=&+%\w.-]*(?:['"][^<>]*>|<\/a>))[?=&+%\w.-]*/ig;
    var timeRegexp = /t=(\d+)[ms]?(\d+)?s?/;

    function contains(str, substr) {
        return (str.indexOf(substr) > -1);
    }

    Service.getIdFromURL = function getIdFromURL(url) {
        var id = url.replace(youtubeRegexp, '$1');

        if (contains(id, ';')) {
            var pieces = id.split(';');

            if (contains(pieces[1], '%')) {
                // links like this:
                // "http://www.youtube.com/attribution_link?a=pxa6goHqzaA&amp;u=%2Fwatch%3Fv%3DdPdgx30w9sU%26feature%3Dshare"
                // have the real query string URI encoded behind a ';'.
                // at this point, `id is 'pxa6goHqzaA;u=%2Fwatch%3Fv%3DdPdgx30w9sU%26feature%3Dshare'
                var uriComponent = decodeURIComponent(pieces[1]);
                id = ('http://youtube.com' + uriComponent)
                        .replace(youtubeRegexp, '$1');
            } else {
                // https://www.youtube.com/watch?v=VbNF9X1waSc&amp;feature=youtu.be
                // `id` looks like 'VbNF9X1waSc;feature=youtu.be' currently.
                // strip the ';feature=youtu.be'
                id = pieces[0];
            }
        } else if (contains(id, '#')) {
            // id might look like '93LvTKF_jW0#t=1'
            // and we want '93LvTKF_jW0'
            id = id.split('#')[0];
        }

        return id;
    };

    Service.getTimeFromURL = function getTimeFromURL(url) {
        url = url || '';

        // t=4m20s
        // returns ['t=4m20s', '4', '20']
        // t=46s
        // returns ['t=46s', '46']
        // t=46
        // returns ['t=46', '46']
        var times = url.match(timeRegexp);

        if (!times) {
            // zero seconds
            return 0;
        }

        // assume the first
        var full = times[0],
            minutes = times[1],
            seconds = times[2];

        // t=4m20s
        if (typeof seconds !== 'undefined') {
            seconds = parseInt(seconds, 10);
            minutes = parseInt(minutes, 10);

        // t=4m
        } else if (contains(full, 'm')) {
            minutes = parseInt(minutes, 10);
            seconds = 0;

        // t=4s
        // t=4
        } else {
            seconds = parseInt(minutes, 10);
            minutes = 0;
        }

        // in seconds
        return seconds + (minutes * 60);
    };

    Service.ready = false;

    function applyServiceIsReady() {
        $rootScope.$apply(function () {
            Service.ready = true;
        });
    };

    // If the library isn't here at all,
    if (typeof YT === "undefined") {
        // ...grab on to global callback, in case it's eventually loaded
        $window.onYouTubeIframeAPIReady = applyServiceIsReady;
        console.log('Unable to find YouTube iframe library on this page.')
    } else if (YT.loaded) {
        Service.ready = true;
    } else {
        YT.ready(applyServiceIsReady);
    }

    return Service;
}])
.directive('youtubeVideo', ['$window', 'youtubeEmbedUtils', function ($window, youtubeEmbedUtils) {
    var uniqId = 1;

    // from YT.PlayerState
    var stateNames = {
        '-1': 'unstarted',
        0: 'ended',
        1: 'playing',
        2: 'paused',
        3: 'buffering',
        5: 'queued'
    };

    var eventPrefix = 'youtube.player.';

    $window.YTConfig = {
        host: 'https://www.youtube.com'
    };

    return {
        restrict: 'EA',
        scope: {
            videoId: '=?',
            videoUrl: '=?',
            player: '=?',
            playerVars: '=?',
            playerHeight: '=?',
            playerWidth: '=?'
        },
        link: function (scope, element, attrs) {
            // allows us to $watch `ready`
            scope.utils = youtubeEmbedUtils;

            // player-id attr > id attr > directive-generated ID
            var playerId = attrs.playerId || element[0].id || 'unique-youtube-embed-id-' + uniqId++;
            element[0].id = playerId;

            // Attach to element
            scope.playerHeight = scope.playerHeight || 390;
            scope.playerWidth = scope.playerWidth || 640;
            scope.playerVars = scope.playerVars || {};

            // YT calls callbacks outside of digest cycle
            function applyBroadcast () {
                var args = Array.prototype.slice.call(arguments);
                scope.$apply(function () {
                    scope.$emit.apply(scope, args);
                });
            }

            function onPlayerStateChange (event) {
                var state = stateNames[event.data];
                if (typeof state !== 'undefined') {
                    applyBroadcast(eventPrefix + state, scope.player, event);
                }
                scope.$apply(function () {
                    scope.player.currentState = state;
                });
            }

            function onPlayerReady (event) {
                applyBroadcast(eventPrefix + 'ready', scope.player, event);
            }

            function onPlayerError (event) {
                applyBroadcast(eventPrefix + 'error', scope.player, event);
            }

            function createPlayer () {
                var playerVars = angular.copy(scope.playerVars);
                playerVars.start = playerVars.start || scope.urlStartTime;
                var player = new YT.Player(playerId, {
                    height: scope.playerHeight,
                    width: scope.playerWidth,
                    videoId: scope.videoId,
                    playerVars: playerVars,
                    events: {
                        onReady: onPlayerReady,
                        onStateChange: onPlayerStateChange,
                        onError: onPlayerError
                    }
                });

                player.id = playerId;
                return player;
            }

            function loadPlayer () {
                if (scope.videoId || scope.playerVars.list) {
                    if (scope.player && typeof scope.player.destroy === 'function') {
                        scope.player.destroy();
                    }

                    scope.player = createPlayer();
                }
            };

            var stopWatchingReady = scope.$watch(
                function () {
                    return scope.utils.ready
                        // Wait until one of them is defined...
                        && (typeof scope.videoUrl !== 'undefined'
                        ||  typeof scope.videoId !== 'undefined'
                        ||  typeof scope.playerVars.list !== 'undefined');
                },
                function (ready) {
                    if (ready) {
                        stopWatchingReady();

                        // URL takes first priority
                        if (typeof scope.videoUrl !== 'undefined') {
                            scope.$watch('videoUrl', function (url) {
                                scope.videoId = scope.utils.getIdFromURL(url);
                                scope.urlStartTime = scope.utils.getTimeFromURL(url);

                                loadPlayer();
                            });

                        // then, a video ID
                        } else if (typeof scope.videoId !== 'undefined') {
                            scope.$watch('videoId', function () {
                                scope.urlStartTime = null;
                                loadPlayer();
                            });

                        // finally, a list
                        } else {
                            scope.$watch('playerVars.list', function () {
                                scope.urlStartTime = null;
                                loadPlayer();
                            });
                        }
                    }
            });

            scope.$watchCollection(['playerHeight', 'playerWidth'], function() {
                if (scope.player) {
                    scope.player.setSize(scope.playerWidth, scope.playerHeight);
                }
            });

            scope.$on('$destroy', function () {
                scope.player && scope.player.destroy();
            });
        }
    };
}]);

var app = angular.module("ntuApp", ['mgo-mousetrap', 'LocalStorageModule', 'angular-marquee', 'youtube-embed', 'rzModule']);


app.config(function(localStorageServiceProvider) {
    localStorageServiceProvider
        .setPrefix('NTU-ICAN-PLAYER');
});

app.controller("MusicPlayerController", function($scope, $timeout, $location, $http, PlayerFactory, googleService, localStorageService) {
    $scope.searching = false;
    $scope.musicLists = [];
    $scope.searchQuery = "";
    $scope.currentYoutubeVideo = undefined;
    $scope.isFavoriteMode = false;
    $scope.favoriteLists = [];
    $scope.labMode = true;

    //broadcasting
    $scope.broadCasting = false;
    $scope.broadCast = "";
    $scope.isbroadCastMarquee = false;

    //標題跑馬燈 Marquee
    $scope.duration = 4000;

    function addMarquee(musicLists) {
        if (musicLists && musicLists.length > 0)
            musicLists.forEach(function(m, i) {
                m.marquee = { scroll: false };

            });
    }

    //youtube
    $scope.playerVars = {
        controls: 0,
        autoplay: 1
    };



    //$scope.priceSlider = 150;
    $scope.slider = {
        value: 50,
        options: {
            id: 'ntu-id',
            floor: 0,
            ceil: 100,
            showSelectionBar: true,
            hidePointerLabels: true,
            hidePointerLabels: true,
            hideLimitLabels: true,
            // showSelectionBarFromValue: true,
            onChange: function(id, value) {
                console.log('on change ' + value);
                PlayerFactory.setVolume(value).then(function(data) {
                    console.log(data);
                    broadCast("調整音量:" + value, false);
                });
            }
        }
    };


    $scope.init = function() {
        $scope.musicLists = loadSearch();
        var favoriteLists = loadFavorite();
        if (favoriteLists)
            $scope.favoriteLists = favoriteLists;
        if (favoriteLists)
            $scope.musicLists.forEach(function(m, i) {
                favoriteLists.forEach(function(f, j) {

                    if (m._id == f._id) m.isFavorite = true;
                });
            });
        addMarquee($scope.musicLists);



        if ($scope.labMode) {
            //實驗室模式
            //讀取音量
            broadCast("WELCOME TO NTU ICAN LAB!", true);
            try {
                PlayerFactory.loadVolume().then(function(data) {
                    console.log(data);
                    $scope.slider.value = data;
                });
            } catch (err) {
                console.log(err);
                alert("請連結ican-5g wifi");
            }

        }

    }


    $scope.switchLabMode = function(event) {
        event.preventDefault();

        $scope.labMode = !$scope.labMode;

        if ($scope.labMode) {
            console.log("WELCOME TO NTU ICAN LAB!");
            broadCast("WELCOME TO NTU ICAN LAB!", true);
            //實驗室模式
            //讀取音量
            try {
                PlayerFactory.loadVolume().then(function(data) {
                    console.log(data);
                    $scope.slider.value = data;
                });
            } catch (err) {
                console.log(err);
                alert("請連結ican-5g wifi");
            }

        }
    }

    $scope.switchFavorite = function(isFavoriteMode) {
        $scope.isFavoriteMode = isFavoriteMode;
        if ($scope.isFavoriteMode) {
            var favoriteLists = loadFavorite();
            if (favoriteLists && favoriteLists.length > 0)
                favoriteLists.forEach(function(m, i) {
                    m.isSelect = false;
                });

            $scope.favoriteLists = favoriteLists;
            $scope.musicLists = favoriteLists;
        } else {
            $scope.init();
        }

    }


    $scope.labPause = function() {
        PlayerFactory.pause().then(function(data) {
            console.log(data);
            broadCast("停止音樂", false);
        });
    }

    $scope.labStop = function() {
        PlayerFactory.play("").then(function(data) {
            console.log(data);
            broadCast("暫停音樂", false);
        });
    }

    $scope.search = function(query) {

        $scope.musicLists = [];
        $scope.searching = true;
        googleService.youtubeSearch(query).then(function(data) {

            if (data.items) {
                data.items.forEach(function(item, i) {

                    var musicCard = {};
                    musicCard._id = item['id']['videoId'];
                    musicCard.title = item['snippet']['title'];
                    musicCard.url = "https://www.youtube.com/embed/" + musicCard._id;
                    musicCard.image = "http://img.youtube.com/vi/" + musicCard._id + "/0.jpg";
                    musicCard.description = item['snippet']['description'];
                    musicCard.isSelect = false;
                    musicCard.isFavorite = false;
                    $scope.musicLists.push(musicCard);

                });


            } else {
                alert("搜尋錯誤");
            }
            $scope.searching = false;
            saveSearch($scope.musicLists);
            addMarquee($scope.musicLists);
        });


    }

    function convert_time(duration) {
        var a = duration.match(/\d+/g);

        if (duration.indexOf('M') >= 0 && duration.indexOf('H') == -1 && duration.indexOf('S') == -1) {
            a = [0, a[0], 0];
        }

        if (duration.indexOf('H') >= 0 && duration.indexOf('M') == -1) {
            a = [a[0], 0, a[1]];
        }
        if (duration.indexOf('H') >= 0 && duration.indexOf('M') == -1 && duration.indexOf('S') == -1) {
            a = [a[0], 0, 0];
        }

        duration = 0;

        if (a.length == 3) {
            duration = duration + parseInt(a[0]) * 3600;
            duration = duration + parseInt(a[1]) * 60;
            duration = duration + parseInt(a[2]);
        }

        if (a.length == 2) {
            duration = duration + parseInt(a[0]) * 60;
            duration = duration + parseInt(a[1]);
        }

        if (a.length == 1) {
            duration = duration + parseInt(a[0]);
        }
        var h = Math.floor(duration / 3600);
        var m = Math.floor(duration % 3600 / 60);
        var s = Math.floor(duration % 3600 % 60);
        return ((h > 0 ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s);
    }

    function loadSearch() {
        console.log("讀取上次搜尋狀態..");
        if (localStorageService.isSupported) {
            return getLocalStorge('NTU-ICAN-PLAYER-SEARCH');
        }

    }

    function saveSearch(musicLists) {

        if (localStorageService.isSupported) {

            setLocalStorge('NTU-ICAN-PLAYER-SEARCH', musicLists)
        }


    }



    $scope.playVideo = function(event, musicCard) {
        event.preventDefault();
        event.stopPropagation();
        console.log(musicCard);


        playVideoInPlayer(musicCard._id);
    }


    function playVideoInPlayer(_id) {
        $scope.currentYoutubeVideo = _id;

    }

    $scope.addToMyFavorite = function(event, musicCard) {

        event.preventDefault();
        event.stopPropagation();
        musicCard.isFavorite = !musicCard.isFavorite;

        if (musicCard.isFavorite)
            $scope.favoriteLists.push(musicCard);
        else {

            var idx = $scope.favoriteLists.indexOf(musicCard);
            $scope.favoriteLists.splice(idx, 1);

        }



        addMarquee($scope.favoriteLists);
        saveFavorite($scope.favoriteLists);

    }

    function loadFavorite() {
        if (localStorageService.isSupported) {
            return getLocalStorge('NTU-ICAN-PLAYER-FAVORITE');
        }
    }

    function saveFavorite(musicLists) {

        if (localStorageService.isSupported) {

            setLocalStorge('NTU-ICAN-PLAYER-FAVORITE', musicLists)
        }


    }

    function setLocalStorge(key, val) {
        return localStorageService.set(key, val);
    }

    function getLocalStorge(key) {
        return localStorageService.get(key);
    }


    $scope.addToPlayerList = function(event, musicCard) {
        event.preventDefault();
        event.stopPropagation();


        PlayerFactory.play(musicCard._id).then(function(data) {
            console.log(data);
            broadCast("實驗室播放等待中", true);
        });


    }



    $scope.selectMusicCard = function(musicCard) {
        var toggle = true;
        if (musicCard.isSelect == true)
            toggle = false;

        cleanSelected();

        musicCard.isSelect = toggle;

    }


    function saveMyFavorite() {
        $scope.musicLists.forEach(function(musicCard, i) {
            musicCard.isSelect = false;

        });

    }

    function cleanSelected() {
        $scope.musicLists.forEach(function(musicCard, i) {
            musicCard.isSelect = false;

        });

    }


    function broadCast(message, isMarquee) {

        $scope.broadCasting = true;
        $scope.isbroadCastMarquee = isMarquee;

        $scope.broadCast = message;
        $timeout(function() {
            $scope.broadCasting = false;

            $scope.broadCast = "";
        }, 3000);

    }


});

app.factory('PlayerFactory', function($q, $http) {


    var _factory = {};
    _factory.play = function(id) {
        var defer = $q.defer();
        $http.get("http://140.112.26.236:80/music?id=" + id)
            .then(function(response) {
                _factory.data = response.data;
                defer.resolve(_factory.data);
            }, function(response) {
                alert("請連結NTUI CAN LAB wifi，或是伺服器錯誤。");
                defer.reject(_factory.data);
            });
        return defer.promise;
    };


    _factory.loadVolume = function() {
        var defer = $q.defer();
        $http.get("http://140.112.26.236:80/get_volume")
            .then(function(response) {
                _factory.data = response.data;
                defer.resolve(_factory.data);
            }, function(response) {
                alert("請連結NTUI CAN LAB wifi，或是伺服器錯誤。");
                defer.reject(_factory.data);
            });
        return defer.promise;
    };

    _factory.setVolume = function(range) {
        var defer = $q.defer();
        $http.get("http://140.112.26.236:80/set_volume?volume=" + range)
            .then(function(response) {
                _factory.data = response.data;
                defer.resolve(_factory.data);
            }, function(response) {
                alert("請連結NTUI CAN LAB wifi，或是伺服器錯誤。");
                defer.reject(_factory.data);
            });
        return defer.promise;
    };
    _factory.pause = function() {
        var defer = $q.defer();
        $http.get("http://140.112.26.236:80/pause_and_play")
            .then(function(response) {
                _factory.data = response.data;
                defer.resolve(_factory.data);
            }, function(response) {
                alert("請連結NTUI CAN LAB wifi，或是伺服器錯誤。");
                defer.reject(_factory.data);
            });
        return defer.promise;
    };





    return _factory;
});

app.factory('googleService', function($q, $http) {

    var _factory = {};


    _factory.youtubeSearch = function(query) {
        var deferred = $q.defer();

        gapi.client.load('youtube', 'v3', function() {
            gapi.client.setApiKey('AIzaSyCRwMuGP50aOvrptyXRZtveE50faOLb8R0');
            var request = gapi.client.youtube.search.list({
                part: 'snippet,id',
                q: query,
                type: 'video',
                maxResults: 24
            });
            request.execute(function(response) {

                deferred.resolve(response.result);
            });
        });
        return deferred.promise;
    };
    _factory.youtubeSearchWithContent = function(query) {
        var deferred = $q.defer();

        gapi.client.load('youtube', 'v3', function() {
            gapi.client.setApiKey('AIzaSyCRwMuGP50aOvrptyXRZtveE50faOLb8R0');
            var request = gapi.client.youtube.search.list({
                part: 'snippet,id',
                q: query,
                type: 'video',
                maxResults: 24
            });
            request.execute(function(response) {
                var searchResults = { items: [] };
                response.result.items.forEach(function(data, i) {
                    var url1 = "https://www.googleapis.com/youtube/v3/videos?id=" + data.id.videoId + "&key=AIzaSyCRwMuGP50aOvrptyXRZtveE50faOLb8R0&part=snippet,contentDetails";
                    $.ajax({
                        async: false,
                        type: 'GET',
                        url: url1,
                        success: function(data) {
                            if (data.items.length > 0) {
                                console.log(data.items[0]);
                                // var output = getResults(data.items[0]);
                                searchResults.items.push(data.items[0]);
                                // $('#results').append(output);
                            }
                        }
                    });
                });

                // deferred.resolve(response.result);
                deferred.resolve(searchResults);

            });
        });

        return deferred.promise;
    };



    return _factory;
});

app.directive('pressEnter', function() {
    return function(scope, element, attrs) {
        element.bind("keydown keypress", function(event) {
            if (event.which === 13) {
                scope.$apply(function() {
                    scope.$eval(attrs.pressEnter);
                });

                event.preventDefault();
            }
        });
    };
});

/*!
 * MizJs v1.0.0 
 * Copyright MizTech
 * Licensed MikeZheng
 * http://mike-zheng.github.io/
 */
 
// ! jQuery v1.9.1 | (c) 2005, 2012 jQuery Foundation, Inc. | jquery.org/license
//@ sourceMappingURL=jquery.min.map
(function(e,t){var n,r,i=typeof t,o=e.document,a=e.location,s=e.jQuery,u=e.$,l={},c=[],p="1.9.1",f=c.concat,d=c.push,h=c.slice,g=c.indexOf,m=l.toString,y=l.hasOwnProperty,v=p.trim,b=function(e,t){return new b.fn.init(e,t,r)},x=/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,w=/\S+/g,T=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,N=/^(?:(<[\w\W]+>)[^>]*|#([\w-]*))$/,C=/^<(\w+)\s*\/?>(?:<\/\1>|)$/,k=/^[\],:{}\s]*$/,E=/(?:^|:|,)(?:\s*\[)+/g,S=/\\(?:["\\\/bfnrt]|u[\da-fA-F]{4})/g,A=/"[^"\\\r\n]*"|true|false|null|-?(?:\d+\.|)\d+(?:[eE][+-]?\d+|)/g,j=/^-ms-/,D=/-([\da-z])/gi,L=function(e,t){return t.toUpperCase()},H=function(e){(o.addEventListener||"load"===e.type||"complete"===o.readyState)&&(q(),b.ready())},q=function(){o.addEventListener?(o.removeEventListener("DOMContentLoaded",H,!1),e.removeEventListener("load",H,!1)):(o.detachEvent("onreadystatechange",H),e.detachEvent("onload",H))};b.fn=b.prototype={jquery:p,constructor:b,init:function(e,n,r){var i,a;if(!e)return this;if("string"==typeof e){if(i="<"===e.charAt(0)&&">"===e.charAt(e.length-1)&&e.length>=3?[null,e,null]:N.exec(e),!i||!i[1]&&n)return!n||n.jquery?(n||r).find(e):this.constructor(n).find(e);if(i[1]){if(n=n instanceof b?n[0]:n,b.merge(this,b.parseHTML(i[1],n&&n.nodeType?n.ownerDocument||n:o,!0)),C.test(i[1])&&b.isPlainObject(n))for(i in n)b.isFunction(this[i])?this[i](n[i]):this.attr(i,n[i]);return this}if(a=o.getElementById(i[2]),a&&a.parentNode){if(a.id!==i[2])return r.find(e);this.length=1,this[0]=a}return this.context=o,this.selector=e,this}return e.nodeType?(this.context=this[0]=e,this.length=1,this):b.isFunction(e)?r.ready(e):(e.selector!==t&&(this.selector=e.selector,this.context=e.context),b.makeArray(e,this))},selector:"",length:0,size:function(){return this.length},toArray:function(){return h.call(this)},get:function(e){return null==e?this.toArray():0>e?this[this.length+e]:this[e]},pushStack:function(e){var t=b.merge(this.constructor(),e);return t.prevObject=this,t.context=this.context,t},each:function(e,t){return b.each(this,e,t)},ready:function(e){return b.ready.promise().done(e),this},slice:function(){return this.pushStack(h.apply(this,arguments))},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},eq:function(e){var t=this.length,n=+e+(0>e?t:0);return this.pushStack(n>=0&&t>n?[this[n]]:[])},map:function(e){return this.pushStack(b.map(this,function(t,n){return e.call(t,n,t)}))},end:function(){return this.prevObject||this.constructor(null)},push:d,sort:[].sort,splice:[].splice},b.fn.init.prototype=b.fn,b.extend=b.fn.extend=function(){var e,n,r,i,o,a,s=arguments[0]||{},u=1,l=arguments.length,c=!1;for("boolean"==typeof s&&(c=s,s=arguments[1]||{},u=2),"object"==typeof s||b.isFunction(s)||(s={}),l===u&&(s=this,--u);l>u;u++)if(null!=(o=arguments[u]))for(i in o)e=s[i],r=o[i],s!==r&&(c&&r&&(b.isPlainObject(r)||(n=b.isArray(r)))?(n?(n=!1,a=e&&b.isArray(e)?e:[]):a=e&&b.isPlainObject(e)?e:{},s[i]=b.extend(c,a,r)):r!==t&&(s[i]=r));return s},b.extend({noConflict:function(t){return e.$===b&&(e.$=u),t&&e.jQuery===b&&(e.jQuery=s),b},isReady:!1,readyWait:1,holdReady:function(e){e?b.readyWait++:b.ready(!0)},ready:function(e){if(e===!0?!--b.readyWait:!b.isReady){if(!o.body)return setTimeout(b.ready);b.isReady=!0,e!==!0&&--b.readyWait>0||(n.resolveWith(o,[b]),b.fn.trigger&&b(o).trigger("ready").off("ready"))}},isFunction:function(e){return"function"===b.type(e)},isArray:Array.isArray||function(e){return"array"===b.type(e)},isWindow:function(e){return null!=e&&e==e.window},isNumeric:function(e){return!isNaN(parseFloat(e))&&isFinite(e)},type:function(e){return null==e?e+"":"object"==typeof e||"function"==typeof e?l[m.call(e)]||"object":typeof e},isPlainObject:function(e){if(!e||"object"!==b.type(e)||e.nodeType||b.isWindow(e))return!1;try{if(e.constructor&&!y.call(e,"constructor")&&!y.call(e.constructor.prototype,"isPrototypeOf"))return!1}catch(n){return!1}var r;for(r in e);return r===t||y.call(e,r)},isEmptyObject:function(e){var t;for(t in e)return!1;return!0},error:function(e){throw Error(e)},parseHTML:function(e,t,n){if(!e||"string"!=typeof e)return null;"boolean"==typeof t&&(n=t,t=!1),t=t||o;var r=C.exec(e),i=!n&&[];return r?[t.createElement(r[1])]:(r=b.buildFragment([e],t,i),i&&b(i).remove(),b.merge([],r.childNodes))},parseJSON:function(n){return e.JSON&&e.JSON.parse?e.JSON.parse(n):null===n?n:"string"==typeof n&&(n=b.trim(n),n&&k.test(n.replace(S,"@").replace(A,"]").replace(E,"")))?Function("return "+n)():(b.error("Invalid JSON: "+n),t)},parseXML:function(n){var r,i;if(!n||"string"!=typeof n)return null;try{e.DOMParser?(i=new DOMParser,r=i.parseFromString(n,"text/xml")):(r=new ActiveXObject("Microsoft.XMLDOM"),r.async="false",r.loadXML(n))}catch(o){r=t}return r&&r.documentElement&&!r.getElementsByTagName("parsererror").length||b.error("Invalid XML: "+n),r},noop:function(){},globalEval:function(t){t&&b.trim(t)&&(e.execScript||function(t){e.eval.call(e,t)})(t)},camelCase:function(e){return e.replace(j,"ms-").replace(D,L)},nodeName:function(e,t){return e.nodeName&&e.nodeName.toLowerCase()===t.toLowerCase()},each:function(e,t,n){var r,i=0,o=e.length,a=M(e);if(n){if(a){for(;o>i;i++)if(r=t.apply(e[i],n),r===!1)break}else for(i in e)if(r=t.apply(e[i],n),r===!1)break}else if(a){for(;o>i;i++)if(r=t.call(e[i],i,e[i]),r===!1)break}else for(i in e)if(r=t.call(e[i],i,e[i]),r===!1)break;return e},trim:v&&!v.call("\ufeff\u00a0")?function(e){return null==e?"":v.call(e)}:function(e){return null==e?"":(e+"").replace(T,"")},makeArray:function(e,t){var n=t||[];return null!=e&&(M(Object(e))?b.merge(n,"string"==typeof e?[e]:e):d.call(n,e)),n},inArray:function(e,t,n){var r;if(t){if(g)return g.call(t,e,n);for(r=t.length,n=n?0>n?Math.max(0,r+n):n:0;r>n;n++)if(n in t&&t[n]===e)return n}return-1},merge:function(e,n){var r=n.length,i=e.length,o=0;if("number"==typeof r)for(;r>o;o++)e[i++]=n[o];else while(n[o]!==t)e[i++]=n[o++];return e.length=i,e},grep:function(e,t,n){var r,i=[],o=0,a=e.length;for(n=!!n;a>o;o++)r=!!t(e[o],o),n!==r&&i.push(e[o]);return i},map:function(e,t,n){var r,i=0,o=e.length,a=M(e),s=[];if(a)for(;o>i;i++)r=t(e[i],i,n),null!=r&&(s[s.length]=r);else for(i in e)r=t(e[i],i,n),null!=r&&(s[s.length]=r);return f.apply([],s)},guid:1,proxy:function(e,n){var r,i,o;return"string"==typeof n&&(o=e[n],n=e,e=o),b.isFunction(e)?(r=h.call(arguments,2),i=function(){return e.apply(n||this,r.concat(h.call(arguments)))},i.guid=e.guid=e.guid||b.guid++,i):t},access:function(e,n,r,i,o,a,s){var u=0,l=e.length,c=null==r;if("object"===b.type(r)){o=!0;for(u in r)b.access(e,n,u,r[u],!0,a,s)}else if(i!==t&&(o=!0,b.isFunction(i)||(s=!0),c&&(s?(n.call(e,i),n=null):(c=n,n=function(e,t,n){return c.call(b(e),n)})),n))for(;l>u;u++)n(e[u],r,s?i:i.call(e[u],u,n(e[u],r)));return o?e:c?n.call(e):l?n(e[0],r):a},now:function(){return(new Date).getTime()}}),b.ready.promise=function(t){if(!n)if(n=b.Deferred(),"complete"===o.readyState)setTimeout(b.ready);else if(o.addEventListener)o.addEventListener("DOMContentLoaded",H,!1),e.addEventListener("load",H,!1);else{o.attachEvent("onreadystatechange",H),e.attachEvent("onload",H);var r=!1;try{r=null==e.frameElement&&o.documentElement}catch(i){}r&&r.doScroll&&function a(){if(!b.isReady){try{r.doScroll("left")}catch(e){return setTimeout(a,50)}q(),b.ready()}}()}return n.promise(t)},b.each("Boolean Number String Function Array Date RegExp Object Error".split(" "),function(e,t){l["[object "+t+"]"]=t.toLowerCase()});function M(e){var t=e.length,n=b.type(e);return b.isWindow(e)?!1:1===e.nodeType&&t?!0:"array"===n||"function"!==n&&(0===t||"number"==typeof t&&t>0&&t-1 in e)}r=b(o);var _={};function F(e){var t=_[e]={};return b.each(e.match(w)||[],function(e,n){t[n]=!0}),t}b.Callbacks=function(e){e="string"==typeof e?_[e]||F(e):b.extend({},e);var n,r,i,o,a,s,u=[],l=!e.once&&[],c=function(t){for(r=e.memory&&t,i=!0,a=s||0,s=0,o=u.length,n=!0;u&&o>a;a++)if(u[a].apply(t[0],t[1])===!1&&e.stopOnFalse){r=!1;break}n=!1,u&&(l?l.length&&c(l.shift()):r?u=[]:p.disable())},p={add:function(){if(u){var t=u.length;(function i(t){b.each(t,function(t,n){var r=b.type(n);"function"===r?e.unique&&p.has(n)||u.push(n):n&&n.length&&"string"!==r&&i(n)})})(arguments),n?o=u.length:r&&(s=t,c(r))}return this},remove:function(){return u&&b.each(arguments,function(e,t){var r;while((r=b.inArray(t,u,r))>-1)u.splice(r,1),n&&(o>=r&&o--,a>=r&&a--)}),this},has:function(e){return e?b.inArray(e,u)>-1:!(!u||!u.length)},empty:function(){return u=[],this},disable:function(){return u=l=r=t,this},disabled:function(){return!u},lock:function(){return l=t,r||p.disable(),this},locked:function(){return!l},fireWith:function(e,t){return t=t||[],t=[e,t.slice?t.slice():t],!u||i&&!l||(n?l.push(t):c(t)),this},fire:function(){return p.fireWith(this,arguments),this},fired:function(){return!!i}};return p},b.extend({Deferred:function(e){var t=[["resolve","done",b.Callbacks("once memory"),"resolved"],["reject","fail",b.Callbacks("once memory"),"rejected"],["notify","progress",b.Callbacks("memory")]],n="pending",r={state:function(){return n},always:function(){return i.done(arguments).fail(arguments),this},then:function(){var e=arguments;return b.Deferred(function(n){b.each(t,function(t,o){var a=o[0],s=b.isFunction(e[t])&&e[t];i[o[1]](function(){var e=s&&s.apply(this,arguments);e&&b.isFunction(e.promise)?e.promise().done(n.resolve).fail(n.reject).progress(n.notify):n[a+"With"](this===r?n.promise():this,s?[e]:arguments)})}),e=null}).promise()},promise:function(e){return null!=e?b.extend(e,r):r}},i={};return r.pipe=r.then,b.each(t,function(e,o){var a=o[2],s=o[3];r[o[1]]=a.add,s&&a.add(function(){n=s},t[1^e][2].disable,t[2][2].lock),i[o[0]]=function(){return i[o[0]+"With"](this===i?r:this,arguments),this},i[o[0]+"With"]=a.fireWith}),r.promise(i),e&&e.call(i,i),i},when:function(e){var t=0,n=h.call(arguments),r=n.length,i=1!==r||e&&b.isFunction(e.promise)?r:0,o=1===i?e:b.Deferred(),a=function(e,t,n){return function(r){t[e]=this,n[e]=arguments.length>1?h.call(arguments):r,n===s?o.notifyWith(t,n):--i||o.resolveWith(t,n)}},s,u,l;if(r>1)for(s=Array(r),u=Array(r),l=Array(r);r>t;t++)n[t]&&b.isFunction(n[t].promise)?n[t].promise().done(a(t,l,n)).fail(o.reject).progress(a(t,u,s)):--i;return i||o.resolveWith(l,n),o.promise()}}),b.support=function(){var t,n,r,a,s,u,l,c,p,f,d=o.createElement("div");if(d.setAttribute("className","t"),d.innerHTML="  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>",n=d.getElementsByTagName("*"),r=d.getElementsByTagName("a")[0],!n||!r||!n.length)return{};s=o.createElement("select"),l=s.appendChild(o.createElement("option")),a=d.getElementsByTagName("input")[0],r.style.cssText="top:1px;float:left;opacity:.5",t={getSetAttribute:"t"!==d.className,leadingWhitespace:3===d.firstChild.nodeType,tbody:!d.getElementsByTagName("tbody").length,htmlSerialize:!!d.getElementsByTagName("link").length,style:/top/.test(r.getAttribute("style")),hrefNormalized:"/a"===r.getAttribute("href"),opacity:/^0.5/.test(r.style.opacity),cssFloat:!!r.style.cssFloat,checkOn:!!a.value,optSelected:l.selected,enctype:!!o.createElement("form").enctype,html5Clone:"<:nav></:nav>"!==o.createElement("nav").cloneNode(!0).outerHTML,boxModel:"CSS1Compat"===o.compatMode,deleteExpando:!0,noCloneEvent:!0,inlineBlockNeedsLayout:!1,shrinkWrapBlocks:!1,reliableMarginRight:!0,boxSizingReliable:!0,pixelPosition:!1},a.checked=!0,t.noCloneChecked=a.cloneNode(!0).checked,s.disabled=!0,t.optDisabled=!l.disabled;try{delete d.test}catch(h){t.deleteExpando=!1}a=o.createElement("input"),a.setAttribute("value",""),t.input=""===a.getAttribute("value"),a.value="t",a.setAttribute("type","radio"),t.radioValue="t"===a.value,a.setAttribute("checked","t"),a.setAttribute("name","t"),u=o.createDocumentFragment(),u.appendChild(a),t.appendChecked=a.checked,t.checkClone=u.cloneNode(!0).cloneNode(!0).lastChild.checked,d.attachEvent&&(d.attachEvent("onclick",function(){t.noCloneEvent=!1}),d.cloneNode(!0).click());for(f in{submit:!0,change:!0,focusin:!0})d.setAttribute(c="on"+f,"t"),t[f+"Bubbles"]=c in e||d.attributes[c].expando===!1;return d.style.backgroundClip="content-box",d.cloneNode(!0).style.backgroundClip="",t.clearCloneStyle="content-box"===d.style.backgroundClip,b(function(){var n,r,a,s="padding:0;margin:0;border:0;display:block;box-sizing:content-box;-moz-box-sizing:content-box;-webkit-box-sizing:content-box;",u=o.getElementsByTagName("body")[0];u&&(n=o.createElement("div"),n.style.cssText="border:0;width:0;height:0;position:absolute;top:0;left:-9999px;margin-top:1px",u.appendChild(n).appendChild(d),d.innerHTML="<table><tr><td></td><td>t</td></tr></table>",a=d.getElementsByTagName("td"),a[0].style.cssText="padding:0;margin:0;border:0;display:none",p=0===a[0].offsetHeight,a[0].style.display="",a[1].style.display="none",t.reliableHiddenOffsets=p&&0===a[0].offsetHeight,d.innerHTML="",d.style.cssText="box-sizing:border-box;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;padding:1px;border:1px;display:block;width:4px;margin-top:1%;position:absolute;top:1%;",t.boxSizing=4===d.offsetWidth,t.doesNotIncludeMarginInBodyOffset=1!==u.offsetTop,e.getComputedStyle&&(t.pixelPosition="1%"!==(e.getComputedStyle(d,null)||{}).top,t.boxSizingReliable="4px"===(e.getComputedStyle(d,null)||{width:"4px"}).width,r=d.appendChild(o.createElement("div")),r.style.cssText=d.style.cssText=s,r.style.marginRight=r.style.width="0",d.style.width="1px",t.reliableMarginRight=!parseFloat((e.getComputedStyle(r,null)||{}).marginRight)),typeof d.style.zoom!==i&&(d.innerHTML="",d.style.cssText=s+"width:1px;padding:1px;display:inline;zoom:1",t.inlineBlockNeedsLayout=3===d.offsetWidth,d.style.display="block",d.innerHTML="<div></div>",d.firstChild.style.width="5px",t.shrinkWrapBlocks=3!==d.offsetWidth,t.inlineBlockNeedsLayout&&(u.style.zoom=1)),u.removeChild(n),n=d=a=r=null)}),n=s=u=l=r=a=null,t}();var O=/(?:\{[\s\S]*\}|\[[\s\S]*\])$/,B=/([A-Z])/g;function P(e,n,r,i){if(b.acceptData(e)){var o,a,s=b.expando,u="string"==typeof n,l=e.nodeType,p=l?b.cache:e,f=l?e[s]:e[s]&&s;if(f&&p[f]&&(i||p[f].data)||!u||r!==t)return f||(l?e[s]=f=c.pop()||b.guid++:f=s),p[f]||(p[f]={},l||(p[f].toJSON=b.noop)),("object"==typeof n||"function"==typeof n)&&(i?p[f]=b.extend(p[f],n):p[f].data=b.extend(p[f].data,n)),o=p[f],i||(o.data||(o.data={}),o=o.data),r!==t&&(o[b.camelCase(n)]=r),u?(a=o[n],null==a&&(a=o[b.camelCase(n)])):a=o,a}}function R(e,t,n){if(b.acceptData(e)){var r,i,o,a=e.nodeType,s=a?b.cache:e,u=a?e[b.expando]:b.expando;if(s[u]){if(t&&(o=n?s[u]:s[u].data)){b.isArray(t)?t=t.concat(b.map(t,b.camelCase)):t in o?t=[t]:(t=b.camelCase(t),t=t in o?[t]:t.split(" "));for(r=0,i=t.length;i>r;r++)delete o[t[r]];if(!(n?$:b.isEmptyObject)(o))return}(n||(delete s[u].data,$(s[u])))&&(a?b.cleanData([e],!0):b.support.deleteExpando||s!=s.window?delete s[u]:s[u]=null)}}}b.extend({cache:{},expando:"jQuery"+(p+Math.random()).replace(/\D/g,""),noData:{embed:!0,object:"clsid:D27CDB6E-AE6D-11cf-96B8-444553540000",applet:!0},hasData:function(e){return e=e.nodeType?b.cache[e[b.expando]]:e[b.expando],!!e&&!$(e)},data:function(e,t,n){return P(e,t,n)},removeData:function(e,t){return R(e,t)},_data:function(e,t,n){return P(e,t,n,!0)},_removeData:function(e,t){return R(e,t,!0)},acceptData:function(e){if(e.nodeType&&1!==e.nodeType&&9!==e.nodeType)return!1;var t=e.nodeName&&b.noData[e.nodeName.toLowerCase()];return!t||t!==!0&&e.getAttribute("classid")===t}}),b.fn.extend({data:function(e,n){var r,i,o=this[0],a=0,s=null;if(e===t){if(this.length&&(s=b.data(o),1===o.nodeType&&!b._data(o,"parsedAttrs"))){for(r=o.attributes;r.length>a;a++)i=r[a].name,i.indexOf("data-")||(i=b.camelCase(i.slice(5)),W(o,i,s[i]));b._data(o,"parsedAttrs",!0)}return s}return"object"==typeof e?this.each(function(){b.data(this,e)}):b.access(this,function(n){return n===t?o?W(o,e,b.data(o,e)):null:(this.each(function(){b.data(this,e,n)}),t)},null,n,arguments.length>1,null,!0)},removeData:function(e){return this.each(function(){b.removeData(this,e)})}});function W(e,n,r){if(r===t&&1===e.nodeType){var i="data-"+n.replace(B,"-$1").toLowerCase();if(r=e.getAttribute(i),"string"==typeof r){try{r="true"===r?!0:"false"===r?!1:"null"===r?null:+r+""===r?+r:O.test(r)?b.parseJSON(r):r}catch(o){}b.data(e,n,r)}else r=t}return r}function $(e){var t;for(t in e)if(("data"!==t||!b.isEmptyObject(e[t]))&&"toJSON"!==t)return!1;return!0}b.extend({queue:function(e,n,r){var i;return e?(n=(n||"fx")+"queue",i=b._data(e,n),r&&(!i||b.isArray(r)?i=b._data(e,n,b.makeArray(r)):i.push(r)),i||[]):t},dequeue:function(e,t){t=t||"fx";var n=b.queue(e,t),r=n.length,i=n.shift(),o=b._queueHooks(e,t),a=function(){b.dequeue(e,t)};"inprogress"===i&&(i=n.shift(),r--),o.cur=i,i&&("fx"===t&&n.unshift("inprogress"),delete o.stop,i.call(e,a,o)),!r&&o&&o.empty.fire()},_queueHooks:function(e,t){var n=t+"queueHooks";return b._data(e,n)||b._data(e,n,{empty:b.Callbacks("once memory").add(function(){b._removeData(e,t+"queue"),b._removeData(e,n)})})}}),b.fn.extend({queue:function(e,n){var r=2;return"string"!=typeof e&&(n=e,e="fx",r--),r>arguments.length?b.queue(this[0],e):n===t?this:this.each(function(){var t=b.queue(this,e,n);b._queueHooks(this,e),"fx"===e&&"inprogress"!==t[0]&&b.dequeue(this,e)})},dequeue:function(e){return this.each(function(){b.dequeue(this,e)})},delay:function(e,t){return e=b.fx?b.fx.speeds[e]||e:e,t=t||"fx",this.queue(t,function(t,n){var r=setTimeout(t,e);n.stop=function(){clearTimeout(r)}})},clearQueue:function(e){return this.queue(e||"fx",[])},promise:function(e,n){var r,i=1,o=b.Deferred(),a=this,s=this.length,u=function(){--i||o.resolveWith(a,[a])};"string"!=typeof e&&(n=e,e=t),e=e||"fx";while(s--)r=b._data(a[s],e+"queueHooks"),r&&r.empty&&(i++,r.empty.add(u));return u(),o.promise(n)}});var I,z,X=/[\t\r\n]/g,U=/\r/g,V=/^(?:input|select|textarea|button|object)$/i,Y=/^(?:a|area)$/i,J=/^(?:checked|selected|autofocus|autoplay|async|controls|defer|disabled|hidden|loop|multiple|open|readonly|required|scoped)$/i,G=/^(?:checked|selected)$/i,Q=b.support.getSetAttribute,K=b.support.input;b.fn.extend({attr:function(e,t){return b.access(this,b.attr,e,t,arguments.length>1)},removeAttr:function(e){return this.each(function(){b.removeAttr(this,e)})},prop:function(e,t){return b.access(this,b.prop,e,t,arguments.length>1)},removeProp:function(e){return e=b.propFix[e]||e,this.each(function(){try{this[e]=t,delete this[e]}catch(n){}})},addClass:function(e){var t,n,r,i,o,a=0,s=this.length,u="string"==typeof e&&e;if(b.isFunction(e))return this.each(function(t){b(this).addClass(e.call(this,t,this.className))});if(u)for(t=(e||"").match(w)||[];s>a;a++)if(n=this[a],r=1===n.nodeType&&(n.className?(" "+n.className+" ").replace(X," "):" ")){o=0;while(i=t[o++])0>r.indexOf(" "+i+" ")&&(r+=i+" ");n.className=b.trim(r)}return this},removeClass:function(e){var t,n,r,i,o,a=0,s=this.length,u=0===arguments.length||"string"==typeof e&&e;if(b.isFunction(e))return this.each(function(t){b(this).removeClass(e.call(this,t,this.className))});if(u)for(t=(e||"").match(w)||[];s>a;a++)if(n=this[a],r=1===n.nodeType&&(n.className?(" "+n.className+" ").replace(X," "):"")){o=0;while(i=t[o++])while(r.indexOf(" "+i+" ")>=0)r=r.replace(" "+i+" "," ");n.className=e?b.trim(r):""}return this},toggleClass:function(e,t){var n=typeof e,r="boolean"==typeof t;return b.isFunction(e)?this.each(function(n){b(this).toggleClass(e.call(this,n,this.className,t),t)}):this.each(function(){if("string"===n){var o,a=0,s=b(this),u=t,l=e.match(w)||[];while(o=l[a++])u=r?u:!s.hasClass(o),s[u?"addClass":"removeClass"](o)}else(n===i||"boolean"===n)&&(this.className&&b._data(this,"__className__",this.className),this.className=this.className||e===!1?"":b._data(this,"__className__")||"")})},hasClass:function(e){var t=" "+e+" ",n=0,r=this.length;for(;r>n;n++)if(1===this[n].nodeType&&(" "+this[n].className+" ").replace(X," ").indexOf(t)>=0)return!0;return!1},val:function(e){var n,r,i,o=this[0];{if(arguments.length)return i=b.isFunction(e),this.each(function(n){var o,a=b(this);1===this.nodeType&&(o=i?e.call(this,n,a.val()):e,null==o?o="":"number"==typeof o?o+="":b.isArray(o)&&(o=b.map(o,function(e){return null==e?"":e+""})),r=b.valHooks[this.type]||b.valHooks[this.nodeName.toLowerCase()],r&&"set"in r&&r.set(this,o,"value")!==t||(this.value=o))});if(o)return r=b.valHooks[o.type]||b.valHooks[o.nodeName.toLowerCase()],r&&"get"in r&&(n=r.get(o,"value"))!==t?n:(n=o.value,"string"==typeof n?n.replace(U,""):null==n?"":n)}}}),b.extend({valHooks:{option:{get:function(e){var t=e.attributes.value;return!t||t.specified?e.value:e.text}},select:{get:function(e){var t,n,r=e.options,i=e.selectedIndex,o="select-one"===e.type||0>i,a=o?null:[],s=o?i+1:r.length,u=0>i?s:o?i:0;for(;s>u;u++)if(n=r[u],!(!n.selected&&u!==i||(b.support.optDisabled?n.disabled:null!==n.getAttribute("disabled"))||n.parentNode.disabled&&b.nodeName(n.parentNode,"optgroup"))){if(t=b(n).val(),o)return t;a.push(t)}return a},set:function(e,t){var n=b.makeArray(t);return b(e).find("option").each(function(){this.selected=b.inArray(b(this).val(),n)>=0}),n.length||(e.selectedIndex=-1),n}}},attr:function(e,n,r){var o,a,s,u=e.nodeType;if(e&&3!==u&&8!==u&&2!==u)return typeof e.getAttribute===i?b.prop(e,n,r):(a=1!==u||!b.isXMLDoc(e),a&&(n=n.toLowerCase(),o=b.attrHooks[n]||(J.test(n)?z:I)),r===t?o&&a&&"get"in o&&null!==(s=o.get(e,n))?s:(typeof e.getAttribute!==i&&(s=e.getAttribute(n)),null==s?t:s):null!==r?o&&a&&"set"in o&&(s=o.set(e,r,n))!==t?s:(e.setAttribute(n,r+""),r):(b.removeAttr(e,n),t))},removeAttr:function(e,t){var n,r,i=0,o=t&&t.match(w);if(o&&1===e.nodeType)while(n=o[i++])r=b.propFix[n]||n,J.test(n)?!Q&&G.test(n)?e[b.camelCase("default-"+n)]=e[r]=!1:e[r]=!1:b.attr(e,n,""),e.removeAttribute(Q?n:r)},attrHooks:{type:{set:function(e,t){if(!b.support.radioValue&&"radio"===t&&b.nodeName(e,"input")){var n=e.value;return e.setAttribute("type",t),n&&(e.value=n),t}}}},propFix:{tabindex:"tabIndex",readonly:"readOnly","for":"htmlFor","class":"className",maxlength:"maxLength",cellspacing:"cellSpacing",cellpadding:"cellPadding",rowspan:"rowSpan",colspan:"colSpan",usemap:"useMap",frameborder:"frameBorder",contenteditable:"contentEditable"},prop:function(e,n,r){var i,o,a,s=e.nodeType;if(e&&3!==s&&8!==s&&2!==s)return a=1!==s||!b.isXMLDoc(e),a&&(n=b.propFix[n]||n,o=b.propHooks[n]),r!==t?o&&"set"in o&&(i=o.set(e,r,n))!==t?i:e[n]=r:o&&"get"in o&&null!==(i=o.get(e,n))?i:e[n]},propHooks:{tabIndex:{get:function(e){var n=e.getAttributeNode("tabindex");return n&&n.specified?parseInt(n.value,10):V.test(e.nodeName)||Y.test(e.nodeName)&&e.href?0:t}}}}),z={get:function(e,n){var r=b.prop(e,n),i="boolean"==typeof r&&e.getAttribute(n),o="boolean"==typeof r?K&&Q?null!=i:G.test(n)?e[b.camelCase("default-"+n)]:!!i:e.getAttributeNode(n);return o&&o.value!==!1?n.toLowerCase():t},set:function(e,t,n){return t===!1?b.removeAttr(e,n):K&&Q||!G.test(n)?e.setAttribute(!Q&&b.propFix[n]||n,n):e[b.camelCase("default-"+n)]=e[n]=!0,n}},K&&Q||(b.attrHooks.value={get:function(e,n){var r=e.getAttributeNode(n);return b.nodeName(e,"input")?e.defaultValue:r&&r.specified?r.value:t},set:function(e,n,r){return b.nodeName(e,"input")?(e.defaultValue=n,t):I&&I.set(e,n,r)}}),Q||(I=b.valHooks.button={get:function(e,n){var r=e.getAttributeNode(n);return r&&("id"===n||"name"===n||"coords"===n?""!==r.value:r.specified)?r.value:t},set:function(e,n,r){var i=e.getAttributeNode(r);return i||e.setAttributeNode(i=e.ownerDocument.createAttribute(r)),i.value=n+="","value"===r||n===e.getAttribute(r)?n:t}},b.attrHooks.contenteditable={get:I.get,set:function(e,t,n){I.set(e,""===t?!1:t,n)}},b.each(["width","height"],function(e,n){b.attrHooks[n]=b.extend(b.attrHooks[n],{set:function(e,r){return""===r?(e.setAttribute(n,"auto"),r):t}})})),b.support.hrefNormalized||(b.each(["href","src","width","height"],function(e,n){b.attrHooks[n]=b.extend(b.attrHooks[n],{get:function(e){var r=e.getAttribute(n,2);return null==r?t:r}})}),b.each(["href","src"],function(e,t){b.propHooks[t]={get:function(e){return e.getAttribute(t,4)}}})),b.support.style||(b.attrHooks.style={get:function(e){return e.style.cssText||t},set:function(e,t){return e.style.cssText=t+""}}),b.support.optSelected||(b.propHooks.selected=b.extend(b.propHooks.selected,{get:function(e){var t=e.parentNode;return t&&(t.selectedIndex,t.parentNode&&t.parentNode.selectedIndex),null}})),b.support.enctype||(b.propFix.enctype="encoding"),b.support.checkOn||b.each(["radio","checkbox"],function(){b.valHooks[this]={get:function(e){return null===e.getAttribute("value")?"on":e.value}}}),b.each(["radio","checkbox"],function(){b.valHooks[this]=b.extend(b.valHooks[this],{set:function(e,n){return b.isArray(n)?e.checked=b.inArray(b(e).val(),n)>=0:t}})});var Z=/^(?:input|select|textarea)$/i,et=/^key/,tt=/^(?:mouse|contextmenu)|click/,nt=/^(?:focusinfocus|focusoutblur)$/,rt=/^([^.]*)(?:\.(.+)|)$/;function it(){return!0}function ot(){return!1}b.event={global:{},add:function(e,n,r,o,a){var s,u,l,c,p,f,d,h,g,m,y,v=b._data(e);if(v){r.handler&&(c=r,r=c.handler,a=c.selector),r.guid||(r.guid=b.guid++),(u=v.events)||(u=v.events={}),(f=v.handle)||(f=v.handle=function(e){return typeof b===i||e&&b.event.triggered===e.type?t:b.event.dispatch.apply(f.elem,arguments)},f.elem=e),n=(n||"").match(w)||[""],l=n.length;while(l--)s=rt.exec(n[l])||[],g=y=s[1],m=(s[2]||"").split(".").sort(),p=b.event.special[g]||{},g=(a?p.delegateType:p.bindType)||g,p=b.event.special[g]||{},d=b.extend({type:g,origType:y,data:o,handler:r,guid:r.guid,selector:a,needsContext:a&&b.expr.match.needsContext.test(a),namespace:m.join(".")},c),(h=u[g])||(h=u[g]=[],h.delegateCount=0,p.setup&&p.setup.call(e,o,m,f)!==!1||(e.addEventListener?e.addEventListener(g,f,!1):e.attachEvent&&e.attachEvent("on"+g,f))),p.add&&(p.add.call(e,d),d.handler.guid||(d.handler.guid=r.guid)),a?h.splice(h.delegateCount++,0,d):h.push(d),b.event.global[g]=!0;e=null}},remove:function(e,t,n,r,i){var o,a,s,u,l,c,p,f,d,h,g,m=b.hasData(e)&&b._data(e);if(m&&(c=m.events)){t=(t||"").match(w)||[""],l=t.length;while(l--)if(s=rt.exec(t[l])||[],d=g=s[1],h=(s[2]||"").split(".").sort(),d){p=b.event.special[d]||{},d=(r?p.delegateType:p.bindType)||d,f=c[d]||[],s=s[2]&&RegExp("(^|\\.)"+h.join("\\.(?:.*\\.|)")+"(\\.|$)"),u=o=f.length;while(o--)a=f[o],!i&&g!==a.origType||n&&n.guid!==a.guid||s&&!s.test(a.namespace)||r&&r!==a.selector&&("**"!==r||!a.selector)||(f.splice(o,1),a.selector&&f.delegateCount--,p.remove&&p.remove.call(e,a));u&&!f.length&&(p.teardown&&p.teardown.call(e,h,m.handle)!==!1||b.removeEvent(e,d,m.handle),delete c[d])}else for(d in c)b.event.remove(e,d+t[l],n,r,!0);b.isEmptyObject(c)&&(delete m.handle,b._removeData(e,"events"))}},trigger:function(n,r,i,a){var s,u,l,c,p,f,d,h=[i||o],g=y.call(n,"type")?n.type:n,m=y.call(n,"namespace")?n.namespace.split("."):[];if(l=f=i=i||o,3!==i.nodeType&&8!==i.nodeType&&!nt.test(g+b.event.triggered)&&(g.indexOf(".")>=0&&(m=g.split("."),g=m.shift(),m.sort()),u=0>g.indexOf(":")&&"on"+g,n=n[b.expando]?n:new b.Event(g,"object"==typeof n&&n),n.isTrigger=!0,n.namespace=m.join("."),n.namespace_re=n.namespace?RegExp("(^|\\.)"+m.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,n.result=t,n.target||(n.target=i),r=null==r?[n]:b.makeArray(r,[n]),p=b.event.special[g]||{},a||!p.trigger||p.trigger.apply(i,r)!==!1)){if(!a&&!p.noBubble&&!b.isWindow(i)){for(c=p.delegateType||g,nt.test(c+g)||(l=l.parentNode);l;l=l.parentNode)h.push(l),f=l;f===(i.ownerDocument||o)&&h.push(f.defaultView||f.parentWindow||e)}d=0;while((l=h[d++])&&!n.isPropagationStopped())n.type=d>1?c:p.bindType||g,s=(b._data(l,"events")||{})[n.type]&&b._data(l,"handle"),s&&s.apply(l,r),s=u&&l[u],s&&b.acceptData(l)&&s.apply&&s.apply(l,r)===!1&&n.preventDefault();if(n.type=g,!(a||n.isDefaultPrevented()||p._default&&p._default.apply(i.ownerDocument,r)!==!1||"click"===g&&b.nodeName(i,"a")||!b.acceptData(i)||!u||!i[g]||b.isWindow(i))){f=i[u],f&&(i[u]=null),b.event.triggered=g;try{i[g]()}catch(v){}b.event.triggered=t,f&&(i[u]=f)}return n.result}},dispatch:function(e){e=b.event.fix(e);var n,r,i,o,a,s=[],u=h.call(arguments),l=(b._data(this,"events")||{})[e.type]||[],c=b.event.special[e.type]||{};if(u[0]=e,e.delegateTarget=this,!c.preDispatch||c.preDispatch.call(this,e)!==!1){s=b.event.handlers.call(this,e,l),n=0;while((o=s[n++])&&!e.isPropagationStopped()){e.currentTarget=o.elem,a=0;while((i=o.handlers[a++])&&!e.isImmediatePropagationStopped())(!e.namespace_re||e.namespace_re.test(i.namespace))&&(e.handleObj=i,e.data=i.data,r=((b.event.special[i.origType]||{}).handle||i.handler).apply(o.elem,u),r!==t&&(e.result=r)===!1&&(e.preventDefault(),e.stopPropagation()))}return c.postDispatch&&c.postDispatch.call(this,e),e.result}},handlers:function(e,n){var r,i,o,a,s=[],u=n.delegateCount,l=e.target;if(u&&l.nodeType&&(!e.button||"click"!==e.type))for(;l!=this;l=l.parentNode||this)if(1===l.nodeType&&(l.disabled!==!0||"click"!==e.type)){for(o=[],a=0;u>a;a++)i=n[a],r=i.selector+" ",o[r]===t&&(o[r]=i.needsContext?b(r,this).index(l)>=0:b.find(r,this,null,[l]).length),o[r]&&o.push(i);o.length&&s.push({elem:l,handlers:o})}return n.length>u&&s.push({elem:this,handlers:n.slice(u)}),s},fix:function(e){if(e[b.expando])return e;var t,n,r,i=e.type,a=e,s=this.fixHooks[i];s||(this.fixHooks[i]=s=tt.test(i)?this.mouseHooks:et.test(i)?this.keyHooks:{}),r=s.props?this.props.concat(s.props):this.props,e=new b.Event(a),t=r.length;while(t--)n=r[t],e[n]=a[n];return e.target||(e.target=a.srcElement||o),3===e.target.nodeType&&(e.target=e.target.parentNode),e.metaKey=!!e.metaKey,s.filter?s.filter(e,a):e},props:"altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),fixHooks:{},keyHooks:{props:"char charCode key keyCode".split(" "),filter:function(e,t){return null==e.which&&(e.which=null!=t.charCode?t.charCode:t.keyCode),e}},mouseHooks:{props:"button buttons clientX clientY fromElement offsetX offsetY pageX pageY screenX screenY toElement".split(" "),filter:function(e,n){var r,i,a,s=n.button,u=n.fromElement;return null==e.pageX&&null!=n.clientX&&(i=e.target.ownerDocument||o,a=i.documentElement,r=i.body,e.pageX=n.clientX+(a&&a.scrollLeft||r&&r.scrollLeft||0)-(a&&a.clientLeft||r&&r.clientLeft||0),e.pageY=n.clientY+(a&&a.scrollTop||r&&r.scrollTop||0)-(a&&a.clientTop||r&&r.clientTop||0)),!e.relatedTarget&&u&&(e.relatedTarget=u===e.target?n.toElement:u),e.which||s===t||(e.which=1&s?1:2&s?3:4&s?2:0),e}},special:{load:{noBubble:!0},click:{trigger:function(){return b.nodeName(this,"input")&&"checkbox"===this.type&&this.click?(this.click(),!1):t}},focus:{trigger:function(){if(this!==o.activeElement&&this.focus)try{return this.focus(),!1}catch(e){}},delegateType:"focusin"},blur:{trigger:function(){return this===o.activeElement&&this.blur?(this.blur(),!1):t},delegateType:"focusout"},beforeunload:{postDispatch:function(e){e.result!==t&&(e.originalEvent.returnValue=e.result)}}},simulate:function(e,t,n,r){var i=b.extend(new b.Event,n,{type:e,isSimulated:!0,originalEvent:{}});r?b.event.trigger(i,null,t):b.event.dispatch.call(t,i),i.isDefaultPrevented()&&n.preventDefault()}},b.removeEvent=o.removeEventListener?function(e,t,n){e.removeEventListener&&e.removeEventListener(t,n,!1)}:function(e,t,n){var r="on"+t;e.detachEvent&&(typeof e[r]===i&&(e[r]=null),e.detachEvent(r,n))},b.Event=function(e,n){return this instanceof b.Event?(e&&e.type?(this.originalEvent=e,this.type=e.type,this.isDefaultPrevented=e.defaultPrevented||e.returnValue===!1||e.getPreventDefault&&e.getPreventDefault()?it:ot):this.type=e,n&&b.extend(this,n),this.timeStamp=e&&e.timeStamp||b.now(),this[b.expando]=!0,t):new b.Event(e,n)},b.Event.prototype={isDefaultPrevented:ot,isPropagationStopped:ot,isImmediatePropagationStopped:ot,preventDefault:function(){var e=this.originalEvent;this.isDefaultPrevented=it,e&&(e.preventDefault?e.preventDefault():e.returnValue=!1)},stopPropagation:function(){var e=this.originalEvent;this.isPropagationStopped=it,e&&(e.stopPropagation&&e.stopPropagation(),e.cancelBubble=!0)},stopImmediatePropagation:function(){this.isImmediatePropagationStopped=it,this.stopPropagation()}},b.each({mouseenter:"mouseover",mouseleave:"mouseout"},function(e,t){b.event.special[e]={delegateType:t,bindType:t,handle:function(e){var n,r=this,i=e.relatedTarget,o=e.handleObj;
return(!i||i!==r&&!b.contains(r,i))&&(e.type=o.origType,n=o.handler.apply(this,arguments),e.type=t),n}}}),b.support.submitBubbles||(b.event.special.submit={setup:function(){return b.nodeName(this,"form")?!1:(b.event.add(this,"click._submit keypress._submit",function(e){var n=e.target,r=b.nodeName(n,"input")||b.nodeName(n,"button")?n.form:t;r&&!b._data(r,"submitBubbles")&&(b.event.add(r,"submit._submit",function(e){e._submit_bubble=!0}),b._data(r,"submitBubbles",!0))}),t)},postDispatch:function(e){e._submit_bubble&&(delete e._submit_bubble,this.parentNode&&!e.isTrigger&&b.event.simulate("submit",this.parentNode,e,!0))},teardown:function(){return b.nodeName(this,"form")?!1:(b.event.remove(this,"._submit"),t)}}),b.support.changeBubbles||(b.event.special.change={setup:function(){return Z.test(this.nodeName)?(("checkbox"===this.type||"radio"===this.type)&&(b.event.add(this,"propertychange._change",function(e){"checked"===e.originalEvent.propertyName&&(this._just_changed=!0)}),b.event.add(this,"click._change",function(e){this._just_changed&&!e.isTrigger&&(this._just_changed=!1),b.event.simulate("change",this,e,!0)})),!1):(b.event.add(this,"beforeactivate._change",function(e){var t=e.target;Z.test(t.nodeName)&&!b._data(t,"changeBubbles")&&(b.event.add(t,"change._change",function(e){!this.parentNode||e.isSimulated||e.isTrigger||b.event.simulate("change",this.parentNode,e,!0)}),b._data(t,"changeBubbles",!0))}),t)},handle:function(e){var n=e.target;return this!==n||e.isSimulated||e.isTrigger||"radio"!==n.type&&"checkbox"!==n.type?e.handleObj.handler.apply(this,arguments):t},teardown:function(){return b.event.remove(this,"._change"),!Z.test(this.nodeName)}}),b.support.focusinBubbles||b.each({focus:"focusin",blur:"focusout"},function(e,t){var n=0,r=function(e){b.event.simulate(t,e.target,b.event.fix(e),!0)};b.event.special[t]={setup:function(){0===n++&&o.addEventListener(e,r,!0)},teardown:function(){0===--n&&o.removeEventListener(e,r,!0)}}}),b.fn.extend({on:function(e,n,r,i,o){var a,s;if("object"==typeof e){"string"!=typeof n&&(r=r||n,n=t);for(a in e)this.on(a,n,r,e[a],o);return this}if(null==r&&null==i?(i=n,r=n=t):null==i&&("string"==typeof n?(i=r,r=t):(i=r,r=n,n=t)),i===!1)i=ot;else if(!i)return this;return 1===o&&(s=i,i=function(e){return b().off(e),s.apply(this,arguments)},i.guid=s.guid||(s.guid=b.guid++)),this.each(function(){b.event.add(this,e,i,r,n)})},one:function(e,t,n,r){return this.on(e,t,n,r,1)},off:function(e,n,r){var i,o;if(e&&e.preventDefault&&e.handleObj)return i=e.handleObj,b(e.delegateTarget).off(i.namespace?i.origType+"."+i.namespace:i.origType,i.selector,i.handler),this;if("object"==typeof e){for(o in e)this.off(o,n,e[o]);return this}return(n===!1||"function"==typeof n)&&(r=n,n=t),r===!1&&(r=ot),this.each(function(){b.event.remove(this,e,r,n)})},bind:function(e,t,n){return this.on(e,null,t,n)},unbind:function(e,t){return this.off(e,null,t)},delegate:function(e,t,n,r){return this.on(t,e,n,r)},undelegate:function(e,t,n){return 1===arguments.length?this.off(e,"**"):this.off(t,e||"**",n)},trigger:function(e,t){return this.each(function(){b.event.trigger(e,t,this)})},triggerHandler:function(e,n){var r=this[0];return r?b.event.trigger(e,n,r,!0):t}}),function(e,t){var n,r,i,o,a,s,u,l,c,p,f,d,h,g,m,y,v,x="sizzle"+-new Date,w=e.document,T={},N=0,C=0,k=it(),E=it(),S=it(),A=typeof t,j=1<<31,D=[],L=D.pop,H=D.push,q=D.slice,M=D.indexOf||function(e){var t=0,n=this.length;for(;n>t;t++)if(this[t]===e)return t;return-1},_="[\\x20\\t\\r\\n\\f]",F="(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",O=F.replace("w","w#"),B="([*^$|!~]?=)",P="\\["+_+"*("+F+")"+_+"*(?:"+B+_+"*(?:(['\"])((?:\\\\.|[^\\\\])*?)\\3|("+O+")|)|)"+_+"*\\]",R=":("+F+")(?:\\(((['\"])((?:\\\\.|[^\\\\])*?)\\3|((?:\\\\.|[^\\\\()[\\]]|"+P.replace(3,8)+")*)|.*)\\)|)",W=RegExp("^"+_+"+|((?:^|[^\\\\])(?:\\\\.)*)"+_+"+$","g"),$=RegExp("^"+_+"*,"+_+"*"),I=RegExp("^"+_+"*([\\x20\\t\\r\\n\\f>+~])"+_+"*"),z=RegExp(R),X=RegExp("^"+O+"$"),U={ID:RegExp("^#("+F+")"),CLASS:RegExp("^\\.("+F+")"),NAME:RegExp("^\\[name=['\"]?("+F+")['\"]?\\]"),TAG:RegExp("^("+F.replace("w","w*")+")"),ATTR:RegExp("^"+P),PSEUDO:RegExp("^"+R),CHILD:RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\("+_+"*(even|odd|(([+-]|)(\\d*)n|)"+_+"*(?:([+-]|)"+_+"*(\\d+)|))"+_+"*\\)|)","i"),needsContext:RegExp("^"+_+"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\("+_+"*((?:-\\d)?\\d*)"+_+"*\\)|)(?=[^-]|$)","i")},V=/[\x20\t\r\n\f]*[+~]/,Y=/^[^{]+\{\s*\[native code/,J=/^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,G=/^(?:input|select|textarea|button)$/i,Q=/^h\d$/i,K=/'|\\/g,Z=/\=[\x20\t\r\n\f]*([^'"\]]*)[\x20\t\r\n\f]*\]/g,et=/\\([\da-fA-F]{1,6}[\x20\t\r\n\f]?|.)/g,tt=function(e,t){var n="0x"+t-65536;return n!==n?t:0>n?String.fromCharCode(n+65536):String.fromCharCode(55296|n>>10,56320|1023&n)};try{q.call(w.documentElement.childNodes,0)[0].nodeType}catch(nt){q=function(e){var t,n=[];while(t=this[e++])n.push(t);return n}}function rt(e){return Y.test(e+"")}function it(){var e,t=[];return e=function(n,r){return t.push(n+=" ")>i.cacheLength&&delete e[t.shift()],e[n]=r}}function ot(e){return e[x]=!0,e}function at(e){var t=p.createElement("div");try{return e(t)}catch(n){return!1}finally{t=null}}function st(e,t,n,r){var i,o,a,s,u,l,f,g,m,v;if((t?t.ownerDocument||t:w)!==p&&c(t),t=t||p,n=n||[],!e||"string"!=typeof e)return n;if(1!==(s=t.nodeType)&&9!==s)return[];if(!d&&!r){if(i=J.exec(e))if(a=i[1]){if(9===s){if(o=t.getElementById(a),!o||!o.parentNode)return n;if(o.id===a)return n.push(o),n}else if(t.ownerDocument&&(o=t.ownerDocument.getElementById(a))&&y(t,o)&&o.id===a)return n.push(o),n}else{if(i[2])return H.apply(n,q.call(t.getElementsByTagName(e),0)),n;if((a=i[3])&&T.getByClassName&&t.getElementsByClassName)return H.apply(n,q.call(t.getElementsByClassName(a),0)),n}if(T.qsa&&!h.test(e)){if(f=!0,g=x,m=t,v=9===s&&e,1===s&&"object"!==t.nodeName.toLowerCase()){l=ft(e),(f=t.getAttribute("id"))?g=f.replace(K,"\\$&"):t.setAttribute("id",g),g="[id='"+g+"'] ",u=l.length;while(u--)l[u]=g+dt(l[u]);m=V.test(e)&&t.parentNode||t,v=l.join(",")}if(v)try{return H.apply(n,q.call(m.querySelectorAll(v),0)),n}catch(b){}finally{f||t.removeAttribute("id")}}}return wt(e.replace(W,"$1"),t,n,r)}a=st.isXML=function(e){var t=e&&(e.ownerDocument||e).documentElement;return t?"HTML"!==t.nodeName:!1},c=st.setDocument=function(e){var n=e?e.ownerDocument||e:w;return n!==p&&9===n.nodeType&&n.documentElement?(p=n,f=n.documentElement,d=a(n),T.tagNameNoComments=at(function(e){return e.appendChild(n.createComment("")),!e.getElementsByTagName("*").length}),T.attributes=at(function(e){e.innerHTML="<select></select>";var t=typeof e.lastChild.getAttribute("multiple");return"boolean"!==t&&"string"!==t}),T.getByClassName=at(function(e){return e.innerHTML="<div class='hidden e'></div><div class='hidden'></div>",e.getElementsByClassName&&e.getElementsByClassName("e").length?(e.lastChild.className="e",2===e.getElementsByClassName("e").length):!1}),T.getByName=at(function(e){e.id=x+0,e.innerHTML="<a name='"+x+"'></a><div name='"+x+"'></div>",f.insertBefore(e,f.firstChild);var t=n.getElementsByName&&n.getElementsByName(x).length===2+n.getElementsByName(x+0).length;return T.getIdNotName=!n.getElementById(x),f.removeChild(e),t}),i.attrHandle=at(function(e){return e.innerHTML="<a href='#'></a>",e.firstChild&&typeof e.firstChild.getAttribute!==A&&"#"===e.firstChild.getAttribute("href")})?{}:{href:function(e){return e.getAttribute("href",2)},type:function(e){return e.getAttribute("type")}},T.getIdNotName?(i.find.ID=function(e,t){if(typeof t.getElementById!==A&&!d){var n=t.getElementById(e);return n&&n.parentNode?[n]:[]}},i.filter.ID=function(e){var t=e.replace(et,tt);return function(e){return e.getAttribute("id")===t}}):(i.find.ID=function(e,n){if(typeof n.getElementById!==A&&!d){var r=n.getElementById(e);return r?r.id===e||typeof r.getAttributeNode!==A&&r.getAttributeNode("id").value===e?[r]:t:[]}},i.filter.ID=function(e){var t=e.replace(et,tt);return function(e){var n=typeof e.getAttributeNode!==A&&e.getAttributeNode("id");return n&&n.value===t}}),i.find.TAG=T.tagNameNoComments?function(e,n){return typeof n.getElementsByTagName!==A?n.getElementsByTagName(e):t}:function(e,t){var n,r=[],i=0,o=t.getElementsByTagName(e);if("*"===e){while(n=o[i++])1===n.nodeType&&r.push(n);return r}return o},i.find.NAME=T.getByName&&function(e,n){return typeof n.getElementsByName!==A?n.getElementsByName(name):t},i.find.CLASS=T.getByClassName&&function(e,n){return typeof n.getElementsByClassName===A||d?t:n.getElementsByClassName(e)},g=[],h=[":focus"],(T.qsa=rt(n.querySelectorAll))&&(at(function(e){e.innerHTML="<select><option selected=''></option></select>",e.querySelectorAll("[selected]").length||h.push("\\["+_+"*(?:checked|disabled|ismap|multiple|readonly|selected|value)"),e.querySelectorAll(":checked").length||h.push(":checked")}),at(function(e){e.innerHTML="<input type='hidden' i=''/>",e.querySelectorAll("[i^='']").length&&h.push("[*^$]="+_+"*(?:\"\"|'')"),e.querySelectorAll(":enabled").length||h.push(":enabled",":disabled"),e.querySelectorAll("*,:x"),h.push(",.*:")})),(T.matchesSelector=rt(m=f.matchesSelector||f.mozMatchesSelector||f.webkitMatchesSelector||f.oMatchesSelector||f.msMatchesSelector))&&at(function(e){T.disconnectedMatch=m.call(e,"div"),m.call(e,"[s!='']:x"),g.push("!=",R)}),h=RegExp(h.join("|")),g=RegExp(g.join("|")),y=rt(f.contains)||f.compareDocumentPosition?function(e,t){var n=9===e.nodeType?e.documentElement:e,r=t&&t.parentNode;return e===r||!(!r||1!==r.nodeType||!(n.contains?n.contains(r):e.compareDocumentPosition&&16&e.compareDocumentPosition(r)))}:function(e,t){if(t)while(t=t.parentNode)if(t===e)return!0;return!1},v=f.compareDocumentPosition?function(e,t){var r;return e===t?(u=!0,0):(r=t.compareDocumentPosition&&e.compareDocumentPosition&&e.compareDocumentPosition(t))?1&r||e.parentNode&&11===e.parentNode.nodeType?e===n||y(w,e)?-1:t===n||y(w,t)?1:0:4&r?-1:1:e.compareDocumentPosition?-1:1}:function(e,t){var r,i=0,o=e.parentNode,a=t.parentNode,s=[e],l=[t];if(e===t)return u=!0,0;if(!o||!a)return e===n?-1:t===n?1:o?-1:a?1:0;if(o===a)return ut(e,t);r=e;while(r=r.parentNode)s.unshift(r);r=t;while(r=r.parentNode)l.unshift(r);while(s[i]===l[i])i++;return i?ut(s[i],l[i]):s[i]===w?-1:l[i]===w?1:0},u=!1,[0,0].sort(v),T.detectDuplicates=u,p):p},st.matches=function(e,t){return st(e,null,null,t)},st.matchesSelector=function(e,t){if((e.ownerDocument||e)!==p&&c(e),t=t.replace(Z,"='$1']"),!(!T.matchesSelector||d||g&&g.test(t)||h.test(t)))try{var n=m.call(e,t);if(n||T.disconnectedMatch||e.document&&11!==e.document.nodeType)return n}catch(r){}return st(t,p,null,[e]).length>0},st.contains=function(e,t){return(e.ownerDocument||e)!==p&&c(e),y(e,t)},st.attr=function(e,t){var n;return(e.ownerDocument||e)!==p&&c(e),d||(t=t.toLowerCase()),(n=i.attrHandle[t])?n(e):d||T.attributes?e.getAttribute(t):((n=e.getAttributeNode(t))||e.getAttribute(t))&&e[t]===!0?t:n&&n.specified?n.value:null},st.error=function(e){throw Error("Syntax error, unrecognized expression: "+e)},st.uniqueSort=function(e){var t,n=[],r=1,i=0;if(u=!T.detectDuplicates,e.sort(v),u){for(;t=e[r];r++)t===e[r-1]&&(i=n.push(r));while(i--)e.splice(n[i],1)}return e};function ut(e,t){var n=t&&e,r=n&&(~t.sourceIndex||j)-(~e.sourceIndex||j);if(r)return r;if(n)while(n=n.nextSibling)if(n===t)return-1;return e?1:-1}function lt(e){return function(t){var n=t.nodeName.toLowerCase();return"input"===n&&t.type===e}}function ct(e){return function(t){var n=t.nodeName.toLowerCase();return("input"===n||"button"===n)&&t.type===e}}function pt(e){return ot(function(t){return t=+t,ot(function(n,r){var i,o=e([],n.length,t),a=o.length;while(a--)n[i=o[a]]&&(n[i]=!(r[i]=n[i]))})})}o=st.getText=function(e){var t,n="",r=0,i=e.nodeType;if(i){if(1===i||9===i||11===i){if("string"==typeof e.textContent)return e.textContent;for(e=e.firstChild;e;e=e.nextSibling)n+=o(e)}else if(3===i||4===i)return e.nodeValue}else for(;t=e[r];r++)n+=o(t);return n},i=st.selectors={cacheLength:50,createPseudo:ot,match:U,find:{},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(e){return e[1]=e[1].replace(et,tt),e[3]=(e[4]||e[5]||"").replace(et,tt),"~="===e[2]&&(e[3]=" "+e[3]+" "),e.slice(0,4)},CHILD:function(e){return e[1]=e[1].toLowerCase(),"nth"===e[1].slice(0,3)?(e[3]||st.error(e[0]),e[4]=+(e[4]?e[5]+(e[6]||1):2*("even"===e[3]||"odd"===e[3])),e[5]=+(e[7]+e[8]||"odd"===e[3])):e[3]&&st.error(e[0]),e},PSEUDO:function(e){var t,n=!e[5]&&e[2];return U.CHILD.test(e[0])?null:(e[4]?e[2]=e[4]:n&&z.test(n)&&(t=ft(n,!0))&&(t=n.indexOf(")",n.length-t)-n.length)&&(e[0]=e[0].slice(0,t),e[2]=n.slice(0,t)),e.slice(0,3))}},filter:{TAG:function(e){return"*"===e?function(){return!0}:(e=e.replace(et,tt).toLowerCase(),function(t){return t.nodeName&&t.nodeName.toLowerCase()===e})},CLASS:function(e){var t=k[e+" "];return t||(t=RegExp("(^|"+_+")"+e+"("+_+"|$)"))&&k(e,function(e){return t.test(e.className||typeof e.getAttribute!==A&&e.getAttribute("class")||"")})},ATTR:function(e,t,n){return function(r){var i=st.attr(r,e);return null==i?"!="===t:t?(i+="","="===t?i===n:"!="===t?i!==n:"^="===t?n&&0===i.indexOf(n):"*="===t?n&&i.indexOf(n)>-1:"$="===t?n&&i.slice(-n.length)===n:"~="===t?(" "+i+" ").indexOf(n)>-1:"|="===t?i===n||i.slice(0,n.length+1)===n+"-":!1):!0}},CHILD:function(e,t,n,r,i){var o="nth"!==e.slice(0,3),a="last"!==e.slice(-4),s="of-type"===t;return 1===r&&0===i?function(e){return!!e.parentNode}:function(t,n,u){var l,c,p,f,d,h,g=o!==a?"nextSibling":"previousSibling",m=t.parentNode,y=s&&t.nodeName.toLowerCase(),v=!u&&!s;if(m){if(o){while(g){p=t;while(p=p[g])if(s?p.nodeName.toLowerCase()===y:1===p.nodeType)return!1;h=g="only"===e&&!h&&"nextSibling"}return!0}if(h=[a?m.firstChild:m.lastChild],a&&v){c=m[x]||(m[x]={}),l=c[e]||[],d=l[0]===N&&l[1],f=l[0]===N&&l[2],p=d&&m.childNodes[d];while(p=++d&&p&&p[g]||(f=d=0)||h.pop())if(1===p.nodeType&&++f&&p===t){c[e]=[N,d,f];break}}else if(v&&(l=(t[x]||(t[x]={}))[e])&&l[0]===N)f=l[1];else while(p=++d&&p&&p[g]||(f=d=0)||h.pop())if((s?p.nodeName.toLowerCase()===y:1===p.nodeType)&&++f&&(v&&((p[x]||(p[x]={}))[e]=[N,f]),p===t))break;return f-=i,f===r||0===f%r&&f/r>=0}}},PSEUDO:function(e,t){var n,r=i.pseudos[e]||i.setFilters[e.toLowerCase()]||st.error("unsupported pseudo: "+e);return r[x]?r(t):r.length>1?(n=[e,e,"",t],i.setFilters.hasOwnProperty(e.toLowerCase())?ot(function(e,n){var i,o=r(e,t),a=o.length;while(a--)i=M.call(e,o[a]),e[i]=!(n[i]=o[a])}):function(e){return r(e,0,n)}):r}},pseudos:{not:ot(function(e){var t=[],n=[],r=s(e.replace(W,"$1"));return r[x]?ot(function(e,t,n,i){var o,a=r(e,null,i,[]),s=e.length;while(s--)(o=a[s])&&(e[s]=!(t[s]=o))}):function(e,i,o){return t[0]=e,r(t,null,o,n),!n.pop()}}),has:ot(function(e){return function(t){return st(e,t).length>0}}),contains:ot(function(e){return function(t){return(t.textContent||t.innerText||o(t)).indexOf(e)>-1}}),lang:ot(function(e){return X.test(e||"")||st.error("unsupported lang: "+e),e=e.replace(et,tt).toLowerCase(),function(t){var n;do if(n=d?t.getAttribute("xml:lang")||t.getAttribute("lang"):t.lang)return n=n.toLowerCase(),n===e||0===n.indexOf(e+"-");while((t=t.parentNode)&&1===t.nodeType);return!1}}),target:function(t){var n=e.location&&e.location.hash;return n&&n.slice(1)===t.id},root:function(e){return e===f},focus:function(e){return e===p.activeElement&&(!p.hasFocus||p.hasFocus())&&!!(e.type||e.href||~e.tabIndex)},enabled:function(e){return e.disabled===!1},disabled:function(e){return e.disabled===!0},checked:function(e){var t=e.nodeName.toLowerCase();return"input"===t&&!!e.checked||"option"===t&&!!e.selected},selected:function(e){return e.parentNode&&e.parentNode.selectedIndex,e.selected===!0},empty:function(e){for(e=e.firstChild;e;e=e.nextSibling)if(e.nodeName>"@"||3===e.nodeType||4===e.nodeType)return!1;return!0},parent:function(e){return!i.pseudos.empty(e)},header:function(e){return Q.test(e.nodeName)},input:function(e){return G.test(e.nodeName)},button:function(e){var t=e.nodeName.toLowerCase();return"input"===t&&"button"===e.type||"button"===t},text:function(e){var t;return"input"===e.nodeName.toLowerCase()&&"text"===e.type&&(null==(t=e.getAttribute("type"))||t.toLowerCase()===e.type)},first:pt(function(){return[0]}),last:pt(function(e,t){return[t-1]}),eq:pt(function(e,t,n){return[0>n?n+t:n]}),even:pt(function(e,t){var n=0;for(;t>n;n+=2)e.push(n);return e}),odd:pt(function(e,t){var n=1;for(;t>n;n+=2)e.push(n);return e}),lt:pt(function(e,t,n){var r=0>n?n+t:n;for(;--r>=0;)e.push(r);return e}),gt:pt(function(e,t,n){var r=0>n?n+t:n;for(;t>++r;)e.push(r);return e})}};for(n in{radio:!0,checkbox:!0,file:!0,password:!0,image:!0})i.pseudos[n]=lt(n);for(n in{submit:!0,reset:!0})i.pseudos[n]=ct(n);function ft(e,t){var n,r,o,a,s,u,l,c=E[e+" "];if(c)return t?0:c.slice(0);s=e,u=[],l=i.preFilter;while(s){(!n||(r=$.exec(s)))&&(r&&(s=s.slice(r[0].length)||s),u.push(o=[])),n=!1,(r=I.exec(s))&&(n=r.shift(),o.push({value:n,type:r[0].replace(W," ")}),s=s.slice(n.length));for(a in i.filter)!(r=U[a].exec(s))||l[a]&&!(r=l[a](r))||(n=r.shift(),o.push({value:n,type:a,matches:r}),s=s.slice(n.length));if(!n)break}return t?s.length:s?st.error(e):E(e,u).slice(0)}function dt(e){var t=0,n=e.length,r="";for(;n>t;t++)r+=e[t].value;return r}function ht(e,t,n){var i=t.dir,o=n&&"parentNode"===i,a=C++;return t.first?function(t,n,r){while(t=t[i])if(1===t.nodeType||o)return e(t,n,r)}:function(t,n,s){var u,l,c,p=N+" "+a;if(s){while(t=t[i])if((1===t.nodeType||o)&&e(t,n,s))return!0}else while(t=t[i])if(1===t.nodeType||o)if(c=t[x]||(t[x]={}),(l=c[i])&&l[0]===p){if((u=l[1])===!0||u===r)return u===!0}else if(l=c[i]=[p],l[1]=e(t,n,s)||r,l[1]===!0)return!0}}function gt(e){return e.length>1?function(t,n,r){var i=e.length;while(i--)if(!e[i](t,n,r))return!1;return!0}:e[0]}function mt(e,t,n,r,i){var o,a=[],s=0,u=e.length,l=null!=t;for(;u>s;s++)(o=e[s])&&(!n||n(o,r,i))&&(a.push(o),l&&t.push(s));return a}function yt(e,t,n,r,i,o){return r&&!r[x]&&(r=yt(r)),i&&!i[x]&&(i=yt(i,o)),ot(function(o,a,s,u){var l,c,p,f=[],d=[],h=a.length,g=o||xt(t||"*",s.nodeType?[s]:s,[]),m=!e||!o&&t?g:mt(g,f,e,s,u),y=n?i||(o?e:h||r)?[]:a:m;if(n&&n(m,y,s,u),r){l=mt(y,d),r(l,[],s,u),c=l.length;while(c--)(p=l[c])&&(y[d[c]]=!(m[d[c]]=p))}if(o){if(i||e){if(i){l=[],c=y.length;while(c--)(p=y[c])&&l.push(m[c]=p);i(null,y=[],l,u)}c=y.length;while(c--)(p=y[c])&&(l=i?M.call(o,p):f[c])>-1&&(o[l]=!(a[l]=p))}}else y=mt(y===a?y.splice(h,y.length):y),i?i(null,a,y,u):H.apply(a,y)})}function vt(e){var t,n,r,o=e.length,a=i.relative[e[0].type],s=a||i.relative[" "],u=a?1:0,c=ht(function(e){return e===t},s,!0),p=ht(function(e){return M.call(t,e)>-1},s,!0),f=[function(e,n,r){return!a&&(r||n!==l)||((t=n).nodeType?c(e,n,r):p(e,n,r))}];for(;o>u;u++)if(n=i.relative[e[u].type])f=[ht(gt(f),n)];else{if(n=i.filter[e[u].type].apply(null,e[u].matches),n[x]){for(r=++u;o>r;r++)if(i.relative[e[r].type])break;return yt(u>1&&gt(f),u>1&&dt(e.slice(0,u-1)).replace(W,"$1"),n,r>u&&vt(e.slice(u,r)),o>r&&vt(e=e.slice(r)),o>r&&dt(e))}f.push(n)}return gt(f)}function bt(e,t){var n=0,o=t.length>0,a=e.length>0,s=function(s,u,c,f,d){var h,g,m,y=[],v=0,b="0",x=s&&[],w=null!=d,T=l,C=s||a&&i.find.TAG("*",d&&u.parentNode||u),k=N+=null==T?1:Math.random()||.1;for(w&&(l=u!==p&&u,r=n);null!=(h=C[b]);b++){if(a&&h){g=0;while(m=e[g++])if(m(h,u,c)){f.push(h);break}w&&(N=k,r=++n)}o&&((h=!m&&h)&&v--,s&&x.push(h))}if(v+=b,o&&b!==v){g=0;while(m=t[g++])m(x,y,u,c);if(s){if(v>0)while(b--)x[b]||y[b]||(y[b]=L.call(f));y=mt(y)}H.apply(f,y),w&&!s&&y.length>0&&v+t.length>1&&st.uniqueSort(f)}return w&&(N=k,l=T),x};return o?ot(s):s}s=st.compile=function(e,t){var n,r=[],i=[],o=S[e+" "];if(!o){t||(t=ft(e)),n=t.length;while(n--)o=vt(t[n]),o[x]?r.push(o):i.push(o);o=S(e,bt(i,r))}return o};function xt(e,t,n){var r=0,i=t.length;for(;i>r;r++)st(e,t[r],n);return n}function wt(e,t,n,r){var o,a,u,l,c,p=ft(e);if(!r&&1===p.length){if(a=p[0]=p[0].slice(0),a.length>2&&"ID"===(u=a[0]).type&&9===t.nodeType&&!d&&i.relative[a[1].type]){if(t=i.find.ID(u.matches[0].replace(et,tt),t)[0],!t)return n;e=e.slice(a.shift().value.length)}o=U.needsContext.test(e)?0:a.length;while(o--){if(u=a[o],i.relative[l=u.type])break;if((c=i.find[l])&&(r=c(u.matches[0].replace(et,tt),V.test(a[0].type)&&t.parentNode||t))){if(a.splice(o,1),e=r.length&&dt(a),!e)return H.apply(n,q.call(r,0)),n;break}}}return s(e,p)(r,t,d,n,V.test(e)),n}i.pseudos.nth=i.pseudos.eq;function Tt(){}i.filters=Tt.prototype=i.pseudos,i.setFilters=new Tt,c(),st.attr=b.attr,b.find=st,b.expr=st.selectors,b.expr[":"]=b.expr.pseudos,b.unique=st.uniqueSort,b.text=st.getText,b.isXMLDoc=st.isXML,b.contains=st.contains}(e);var at=/Until$/,st=/^(?:parents|prev(?:Until|All))/,ut=/^.[^:#\[\.,]*$/,lt=b.expr.match.needsContext,ct={children:!0,contents:!0,next:!0,prev:!0};b.fn.extend({find:function(e){var t,n,r,i=this.length;if("string"!=typeof e)return r=this,this.pushStack(b(e).filter(function(){for(t=0;i>t;t++)if(b.contains(r[t],this))return!0}));for(n=[],t=0;i>t;t++)b.find(e,this[t],n);return n=this.pushStack(i>1?b.unique(n):n),n.selector=(this.selector?this.selector+" ":"")+e,n},has:function(e){var t,n=b(e,this),r=n.length;return this.filter(function(){for(t=0;r>t;t++)if(b.contains(this,n[t]))return!0})},not:function(e){return this.pushStack(ft(this,e,!1))},filter:function(e){return this.pushStack(ft(this,e,!0))},is:function(e){return!!e&&("string"==typeof e?lt.test(e)?b(e,this.context).index(this[0])>=0:b.filter(e,this).length>0:this.filter(e).length>0)},closest:function(e,t){var n,r=0,i=this.length,o=[],a=lt.test(e)||"string"!=typeof e?b(e,t||this.context):0;for(;i>r;r++){n=this[r];while(n&&n.ownerDocument&&n!==t&&11!==n.nodeType){if(a?a.index(n)>-1:b.find.matchesSelector(n,e)){o.push(n);break}n=n.parentNode}}return this.pushStack(o.length>1?b.unique(o):o)},index:function(e){return e?"string"==typeof e?b.inArray(this[0],b(e)):b.inArray(e.jquery?e[0]:e,this):this[0]&&this[0].parentNode?this.first().prevAll().length:-1},add:function(e,t){var n="string"==typeof e?b(e,t):b.makeArray(e&&e.nodeType?[e]:e),r=b.merge(this.get(),n);return this.pushStack(b.unique(r))},addBack:function(e){return this.add(null==e?this.prevObject:this.prevObject.filter(e))}}),b.fn.andSelf=b.fn.addBack;function pt(e,t){do e=e[t];while(e&&1!==e.nodeType);return e}b.each({parent:function(e){var t=e.parentNode;return t&&11!==t.nodeType?t:null},parents:function(e){return b.dir(e,"parentNode")},parentsUntil:function(e,t,n){return b.dir(e,"parentNode",n)},next:function(e){return pt(e,"nextSibling")},prev:function(e){return pt(e,"previousSibling")},nextAll:function(e){return b.dir(e,"nextSibling")},prevAll:function(e){return b.dir(e,"previousSibling")},nextUntil:function(e,t,n){return b.dir(e,"nextSibling",n)},prevUntil:function(e,t,n){return b.dir(e,"previousSibling",n)},siblings:function(e){return b.sibling((e.parentNode||{}).firstChild,e)},children:function(e){return b.sibling(e.firstChild)},contents:function(e){return b.nodeName(e,"iframe")?e.contentDocument||e.contentWindow.document:b.merge([],e.childNodes)}},function(e,t){b.fn[e]=function(n,r){var i=b.map(this,t,n);return at.test(e)||(r=n),r&&"string"==typeof r&&(i=b.filter(r,i)),i=this.length>1&&!ct[e]?b.unique(i):i,this.length>1&&st.test(e)&&(i=i.reverse()),this.pushStack(i)}}),b.extend({filter:function(e,t,n){return n&&(e=":not("+e+")"),1===t.length?b.find.matchesSelector(t[0],e)?[t[0]]:[]:b.find.matches(e,t)},dir:function(e,n,r){var i=[],o=e[n];while(o&&9!==o.nodeType&&(r===t||1!==o.nodeType||!b(o).is(r)))1===o.nodeType&&i.push(o),o=o[n];return i},sibling:function(e,t){var n=[];for(;e;e=e.nextSibling)1===e.nodeType&&e!==t&&n.push(e);return n}});function ft(e,t,n){if(t=t||0,b.isFunction(t))return b.grep(e,function(e,r){var i=!!t.call(e,r,e);return i===n});if(t.nodeType)return b.grep(e,function(e){return e===t===n});if("string"==typeof t){var r=b.grep(e,function(e){return 1===e.nodeType});if(ut.test(t))return b.filter(t,r,!n);t=b.filter(t,r)}return b.grep(e,function(e){return b.inArray(e,t)>=0===n})}function dt(e){var t=ht.split("|"),n=e.createDocumentFragment();if(n.createElement)while(t.length)n.createElement(t.pop());return n}var ht="abbr|article|aside|audio|bdi|canvas|data|datalist|details|figcaption|figure|footer|header|hgroup|mark|meter|nav|output|progress|section|summary|time|video",gt=/ jQuery\d+="(?:null|\d+)"/g,mt=RegExp("<(?:"+ht+")[\\s/>]","i"),yt=/^\s+/,vt=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,bt=/<([\w:]+)/,xt=/<tbody/i,wt=/<|&#?\w+;/,Tt=/<(?:script|style|link)/i,Nt=/^(?:checkbox|radio)$/i,Ct=/checked\s*(?:[^=]|=\s*.checked.)/i,kt=/^$|\/(?:java|ecma)script/i,Et=/^true\/(.*)/,St=/^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,At={option:[1,"<select multiple='multiple'>","</select>"],legend:[1,"<fieldset>","</fieldset>"],area:[1,"<map>","</map>"],param:[1,"<object>","</object>"],thead:[1,"<table>","</table>"],tr:[2,"<table><tbody>","</tbody></table>"],col:[2,"<table><tbody></tbody><colgroup>","</colgroup></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],_default:b.support.htmlSerialize?[0,"",""]:[1,"X<div>","</div>"]},jt=dt(o),Dt=jt.appendChild(o.createElement("div"));At.optgroup=At.option,At.tbody=At.tfoot=At.colgroup=At.caption=At.thead,At.th=At.td,b.fn.extend({text:function(e){return b.access(this,function(e){return e===t?b.text(this):this.empty().append((this[0]&&this[0].ownerDocument||o).createTextNode(e))},null,e,arguments.length)},wrapAll:function(e){if(b.isFunction(e))return this.each(function(t){b(this).wrapAll(e.call(this,t))});if(this[0]){var t=b(e,this[0].ownerDocument).eq(0).clone(!0);this[0].parentNode&&t.insertBefore(this[0]),t.map(function(){var e=this;while(e.firstChild&&1===e.firstChild.nodeType)e=e.firstChild;return e}).append(this)}return this},wrapInner:function(e){return b.isFunction(e)?this.each(function(t){b(this).wrapInner(e.call(this,t))}):this.each(function(){var t=b(this),n=t.contents();n.length?n.wrapAll(e):t.append(e)})},wrap:function(e){var t=b.isFunction(e);return this.each(function(n){b(this).wrapAll(t?e.call(this,n):e)})},unwrap:function(){return this.parent().each(function(){b.nodeName(this,"body")||b(this).replaceWith(this.childNodes)}).end()},append:function(){return this.domManip(arguments,!0,function(e){(1===this.nodeType||11===this.nodeType||9===this.nodeType)&&this.appendChild(e)})},prepend:function(){return this.domManip(arguments,!0,function(e){(1===this.nodeType||11===this.nodeType||9===this.nodeType)&&this.insertBefore(e,this.firstChild)})},before:function(){return this.domManip(arguments,!1,function(e){this.parentNode&&this.parentNode.insertBefore(e,this)})},after:function(){return this.domManip(arguments,!1,function(e){this.parentNode&&this.parentNode.insertBefore(e,this.nextSibling)})},remove:function(e,t){var n,r=0;for(;null!=(n=this[r]);r++)(!e||b.filter(e,[n]).length>0)&&(t||1!==n.nodeType||b.cleanData(Ot(n)),n.parentNode&&(t&&b.contains(n.ownerDocument,n)&&Mt(Ot(n,"script")),n.parentNode.removeChild(n)));return this},empty:function(){var e,t=0;for(;null!=(e=this[t]);t++){1===e.nodeType&&b.cleanData(Ot(e,!1));while(e.firstChild)e.removeChild(e.firstChild);e.options&&b.nodeName(e,"select")&&(e.options.length=0)}return this},clone:function(e,t){return e=null==e?!1:e,t=null==t?e:t,this.map(function(){return b.clone(this,e,t)})},html:function(e){return b.access(this,function(e){var n=this[0]||{},r=0,i=this.length;if(e===t)return 1===n.nodeType?n.innerHTML.replace(gt,""):t;if(!("string"!=typeof e||Tt.test(e)||!b.support.htmlSerialize&&mt.test(e)||!b.support.leadingWhitespace&&yt.test(e)||At[(bt.exec(e)||["",""])[1].toLowerCase()])){e=e.replace(vt,"<$1></$2>");try{for(;i>r;r++)n=this[r]||{},1===n.nodeType&&(b.cleanData(Ot(n,!1)),n.innerHTML=e);n=0}catch(o){}}n&&this.empty().append(e)},null,e,arguments.length)},replaceWith:function(e){var t=b.isFunction(e);return t||"string"==typeof e||(e=b(e).not(this).detach()),this.domManip([e],!0,function(e){var t=this.nextSibling,n=this.parentNode;n&&(b(this).remove(),n.insertBefore(e,t))})},detach:function(e){return this.remove(e,!0)},domManip:function(e,n,r){e=f.apply([],e);var i,o,a,s,u,l,c=0,p=this.length,d=this,h=p-1,g=e[0],m=b.isFunction(g);if(m||!(1>=p||"string"!=typeof g||b.support.checkClone)&&Ct.test(g))return this.each(function(i){var o=d.eq(i);m&&(e[0]=g.call(this,i,n?o.html():t)),o.domManip(e,n,r)});if(p&&(l=b.buildFragment(e,this[0].ownerDocument,!1,this),i=l.firstChild,1===l.childNodes.length&&(l=i),i)){for(n=n&&b.nodeName(i,"tr"),s=b.map(Ot(l,"script"),Ht),a=s.length;p>c;c++)o=l,c!==h&&(o=b.clone(o,!0,!0),a&&b.merge(s,Ot(o,"script"))),r.call(n&&b.nodeName(this[c],"table")?Lt(this[c],"tbody"):this[c],o,c);if(a)for(u=s[s.length-1].ownerDocument,b.map(s,qt),c=0;a>c;c++)o=s[c],kt.test(o.type||"")&&!b._data(o,"globalEval")&&b.contains(u,o)&&(o.src?b.ajax({url:o.src,type:"GET",dataType:"script",async:!1,global:!1,"throws":!0}):b.globalEval((o.text||o.textContent||o.innerHTML||"").replace(St,"")));l=i=null}return this}});function Lt(e,t){return e.getElementsByTagName(t)[0]||e.appendChild(e.ownerDocument.createElement(t))}function Ht(e){var t=e.getAttributeNode("type");return e.type=(t&&t.specified)+"/"+e.type,e}function qt(e){var t=Et.exec(e.type);return t?e.type=t[1]:e.removeAttribute("type"),e}function Mt(e,t){var n,r=0;for(;null!=(n=e[r]);r++)b._data(n,"globalEval",!t||b._data(t[r],"globalEval"))}function _t(e,t){if(1===t.nodeType&&b.hasData(e)){var n,r,i,o=b._data(e),a=b._data(t,o),s=o.events;if(s){delete a.handle,a.events={};for(n in s)for(r=0,i=s[n].length;i>r;r++)b.event.add(t,n,s[n][r])}a.data&&(a.data=b.extend({},a.data))}}function Ft(e,t){var n,r,i;if(1===t.nodeType){if(n=t.nodeName.toLowerCase(),!b.support.noCloneEvent&&t[b.expando]){i=b._data(t);for(r in i.events)b.removeEvent(t,r,i.handle);t.removeAttribute(b.expando)}"script"===n&&t.text!==e.text?(Ht(t).text=e.text,qt(t)):"object"===n?(t.parentNode&&(t.outerHTML=e.outerHTML),b.support.html5Clone&&e.innerHTML&&!b.trim(t.innerHTML)&&(t.innerHTML=e.innerHTML)):"input"===n&&Nt.test(e.type)?(t.defaultChecked=t.checked=e.checked,t.value!==e.value&&(t.value=e.value)):"option"===n?t.defaultSelected=t.selected=e.defaultSelected:("input"===n||"textarea"===n)&&(t.defaultValue=e.defaultValue)}}b.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(e,t){b.fn[e]=function(e){var n,r=0,i=[],o=b(e),a=o.length-1;for(;a>=r;r++)n=r===a?this:this.clone(!0),b(o[r])[t](n),d.apply(i,n.get());return this.pushStack(i)}});function Ot(e,n){var r,o,a=0,s=typeof e.getElementsByTagName!==i?e.getElementsByTagName(n||"*"):typeof e.querySelectorAll!==i?e.querySelectorAll(n||"*"):t;if(!s)for(s=[],r=e.childNodes||e;null!=(o=r[a]);a++)!n||b.nodeName(o,n)?s.push(o):b.merge(s,Ot(o,n));return n===t||n&&b.nodeName(e,n)?b.merge([e],s):s}function Bt(e){Nt.test(e.type)&&(e.defaultChecked=e.checked)}b.extend({clone:function(e,t,n){var r,i,o,a,s,u=b.contains(e.ownerDocument,e);if(b.support.html5Clone||b.isXMLDoc(e)||!mt.test("<"+e.nodeName+">")?o=e.cloneNode(!0):(Dt.innerHTML=e.outerHTML,Dt.removeChild(o=Dt.firstChild)),!(b.support.noCloneEvent&&b.support.noCloneChecked||1!==e.nodeType&&11!==e.nodeType||b.isXMLDoc(e)))for(r=Ot(o),s=Ot(e),a=0;null!=(i=s[a]);++a)r[a]&&Ft(i,r[a]);if(t)if(n)for(s=s||Ot(e),r=r||Ot(o),a=0;null!=(i=s[a]);a++)_t(i,r[a]);else _t(e,o);return r=Ot(o,"script"),r.length>0&&Mt(r,!u&&Ot(e,"script")),r=s=i=null,o},buildFragment:function(e,t,n,r){var i,o,a,s,u,l,c,p=e.length,f=dt(t),d=[],h=0;for(;p>h;h++)if(o=e[h],o||0===o)if("object"===b.type(o))b.merge(d,o.nodeType?[o]:o);else if(wt.test(o)){s=s||f.appendChild(t.createElement("div")),u=(bt.exec(o)||["",""])[1].toLowerCase(),c=At[u]||At._default,s.innerHTML=c[1]+o.replace(vt,"<$1></$2>")+c[2],i=c[0];while(i--)s=s.lastChild;if(!b.support.leadingWhitespace&&yt.test(o)&&d.push(t.createTextNode(yt.exec(o)[0])),!b.support.tbody){o="table"!==u||xt.test(o)?"<table>"!==c[1]||xt.test(o)?0:s:s.firstChild,i=o&&o.childNodes.length;while(i--)b.nodeName(l=o.childNodes[i],"tbody")&&!l.childNodes.length&&o.removeChild(l)
}b.merge(d,s.childNodes),s.textContent="";while(s.firstChild)s.removeChild(s.firstChild);s=f.lastChild}else d.push(t.createTextNode(o));s&&f.removeChild(s),b.support.appendChecked||b.grep(Ot(d,"input"),Bt),h=0;while(o=d[h++])if((!r||-1===b.inArray(o,r))&&(a=b.contains(o.ownerDocument,o),s=Ot(f.appendChild(o),"script"),a&&Mt(s),n)){i=0;while(o=s[i++])kt.test(o.type||"")&&n.push(o)}return s=null,f},cleanData:function(e,t){var n,r,o,a,s=0,u=b.expando,l=b.cache,p=b.support.deleteExpando,f=b.event.special;for(;null!=(n=e[s]);s++)if((t||b.acceptData(n))&&(o=n[u],a=o&&l[o])){if(a.events)for(r in a.events)f[r]?b.event.remove(n,r):b.removeEvent(n,r,a.handle);l[o]&&(delete l[o],p?delete n[u]:typeof n.removeAttribute!==i?n.removeAttribute(u):n[u]=null,c.push(o))}}});var Pt,Rt,Wt,$t=/alpha\([^)]*\)/i,It=/opacity\s*=\s*([^)]*)/,zt=/^(top|right|bottom|left)$/,Xt=/^(none|table(?!-c[ea]).+)/,Ut=/^margin/,Vt=RegExp("^("+x+")(.*)$","i"),Yt=RegExp("^("+x+")(?!px)[a-z%]+$","i"),Jt=RegExp("^([+-])=("+x+")","i"),Gt={BODY:"block"},Qt={position:"absolute",visibility:"hidden",display:"block"},Kt={letterSpacing:0,fontWeight:400},Zt=["Top","Right","Bottom","Left"],en=["Webkit","O","Moz","ms"];function tn(e,t){if(t in e)return t;var n=t.charAt(0).toUpperCase()+t.slice(1),r=t,i=en.length;while(i--)if(t=en[i]+n,t in e)return t;return r}function nn(e,t){return e=t||e,"none"===b.css(e,"display")||!b.contains(e.ownerDocument,e)}function rn(e,t){var n,r,i,o=[],a=0,s=e.length;for(;s>a;a++)r=e[a],r.style&&(o[a]=b._data(r,"olddisplay"),n=r.style.display,t?(o[a]||"none"!==n||(r.style.display=""),""===r.style.display&&nn(r)&&(o[a]=b._data(r,"olddisplay",un(r.nodeName)))):o[a]||(i=nn(r),(n&&"none"!==n||!i)&&b._data(r,"olddisplay",i?n:b.css(r,"display"))));for(a=0;s>a;a++)r=e[a],r.style&&(t&&"none"!==r.style.display&&""!==r.style.display||(r.style.display=t?o[a]||"":"none"));return e}b.fn.extend({css:function(e,n){return b.access(this,function(e,n,r){var i,o,a={},s=0;if(b.isArray(n)){for(o=Rt(e),i=n.length;i>s;s++)a[n[s]]=b.css(e,n[s],!1,o);return a}return r!==t?b.style(e,n,r):b.css(e,n)},e,n,arguments.length>1)},show:function(){return rn(this,!0)},hide:function(){return rn(this)},toggle:function(e){var t="boolean"==typeof e;return this.each(function(){(t?e:nn(this))?b(this).show():b(this).hide()})}}),b.extend({cssHooks:{opacity:{get:function(e,t){if(t){var n=Wt(e,"opacity");return""===n?"1":n}}}},cssNumber:{columnCount:!0,fillOpacity:!0,fontWeight:!0,lineHeight:!0,opacity:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{"float":b.support.cssFloat?"cssFloat":"styleFloat"},style:function(e,n,r,i){if(e&&3!==e.nodeType&&8!==e.nodeType&&e.style){var o,a,s,u=b.camelCase(n),l=e.style;if(n=b.cssProps[u]||(b.cssProps[u]=tn(l,u)),s=b.cssHooks[n]||b.cssHooks[u],r===t)return s&&"get"in s&&(o=s.get(e,!1,i))!==t?o:l[n];if(a=typeof r,"string"===a&&(o=Jt.exec(r))&&(r=(o[1]+1)*o[2]+parseFloat(b.css(e,n)),a="number"),!(null==r||"number"===a&&isNaN(r)||("number"!==a||b.cssNumber[u]||(r+="px"),b.support.clearCloneStyle||""!==r||0!==n.indexOf("background")||(l[n]="inherit"),s&&"set"in s&&(r=s.set(e,r,i))===t)))try{l[n]=r}catch(c){}}},css:function(e,n,r,i){var o,a,s,u=b.camelCase(n);return n=b.cssProps[u]||(b.cssProps[u]=tn(e.style,u)),s=b.cssHooks[n]||b.cssHooks[u],s&&"get"in s&&(a=s.get(e,!0,r)),a===t&&(a=Wt(e,n,i)),"normal"===a&&n in Kt&&(a=Kt[n]),""===r||r?(o=parseFloat(a),r===!0||b.isNumeric(o)?o||0:a):a},swap:function(e,t,n,r){var i,o,a={};for(o in t)a[o]=e.style[o],e.style[o]=t[o];i=n.apply(e,r||[]);for(o in t)e.style[o]=a[o];return i}}),e.getComputedStyle?(Rt=function(t){return e.getComputedStyle(t,null)},Wt=function(e,n,r){var i,o,a,s=r||Rt(e),u=s?s.getPropertyValue(n)||s[n]:t,l=e.style;return s&&(""!==u||b.contains(e.ownerDocument,e)||(u=b.style(e,n)),Yt.test(u)&&Ut.test(n)&&(i=l.width,o=l.minWidth,a=l.maxWidth,l.minWidth=l.maxWidth=l.width=u,u=s.width,l.width=i,l.minWidth=o,l.maxWidth=a)),u}):o.documentElement.currentStyle&&(Rt=function(e){return e.currentStyle},Wt=function(e,n,r){var i,o,a,s=r||Rt(e),u=s?s[n]:t,l=e.style;return null==u&&l&&l[n]&&(u=l[n]),Yt.test(u)&&!zt.test(n)&&(i=l.left,o=e.runtimeStyle,a=o&&o.left,a&&(o.left=e.currentStyle.left),l.left="fontSize"===n?"1em":u,u=l.pixelLeft+"px",l.left=i,a&&(o.left=a)),""===u?"auto":u});function on(e,t,n){var r=Vt.exec(t);return r?Math.max(0,r[1]-(n||0))+(r[2]||"px"):t}function an(e,t,n,r,i){var o=n===(r?"border":"content")?4:"width"===t?1:0,a=0;for(;4>o;o+=2)"margin"===n&&(a+=b.css(e,n+Zt[o],!0,i)),r?("content"===n&&(a-=b.css(e,"padding"+Zt[o],!0,i)),"margin"!==n&&(a-=b.css(e,"border"+Zt[o]+"Width",!0,i))):(a+=b.css(e,"padding"+Zt[o],!0,i),"padding"!==n&&(a+=b.css(e,"border"+Zt[o]+"Width",!0,i)));return a}function sn(e,t,n){var r=!0,i="width"===t?e.offsetWidth:e.offsetHeight,o=Rt(e),a=b.support.boxSizing&&"border-box"===b.css(e,"boxSizing",!1,o);if(0>=i||null==i){if(i=Wt(e,t,o),(0>i||null==i)&&(i=e.style[t]),Yt.test(i))return i;r=a&&(b.support.boxSizingReliable||i===e.style[t]),i=parseFloat(i)||0}return i+an(e,t,n||(a?"border":"content"),r,o)+"px"}function un(e){var t=o,n=Gt[e];return n||(n=ln(e,t),"none"!==n&&n||(Pt=(Pt||b("<iframe frameborder='0' width='0' height='0'/>").css("cssText","display:block !important")).appendTo(t.documentElement),t=(Pt[0].contentWindow||Pt[0].contentDocument).document,t.write("<!doctype html><html><body>"),t.close(),n=ln(e,t),Pt.detach()),Gt[e]=n),n}function ln(e,t){var n=b(t.createElement(e)).appendTo(t.body),r=b.css(n[0],"display");return n.remove(),r}b.each(["height","width"],function(e,n){b.cssHooks[n]={get:function(e,r,i){return r?0===e.offsetWidth&&Xt.test(b.css(e,"display"))?b.swap(e,Qt,function(){return sn(e,n,i)}):sn(e,n,i):t},set:function(e,t,r){var i=r&&Rt(e);return on(e,t,r?an(e,n,r,b.support.boxSizing&&"border-box"===b.css(e,"boxSizing",!1,i),i):0)}}}),b.support.opacity||(b.cssHooks.opacity={get:function(e,t){return It.test((t&&e.currentStyle?e.currentStyle.filter:e.style.filter)||"")?.01*parseFloat(RegExp.$1)+"":t?"1":""},set:function(e,t){var n=e.style,r=e.currentStyle,i=b.isNumeric(t)?"alpha(opacity="+100*t+")":"",o=r&&r.filter||n.filter||"";n.zoom=1,(t>=1||""===t)&&""===b.trim(o.replace($t,""))&&n.removeAttribute&&(n.removeAttribute("filter"),""===t||r&&!r.filter)||(n.filter=$t.test(o)?o.replace($t,i):o+" "+i)}}),b(function(){b.support.reliableMarginRight||(b.cssHooks.marginRight={get:function(e,n){return n?b.swap(e,{display:"inline-block"},Wt,[e,"marginRight"]):t}}),!b.support.pixelPosition&&b.fn.position&&b.each(["top","left"],function(e,n){b.cssHooks[n]={get:function(e,r){return r?(r=Wt(e,n),Yt.test(r)?b(e).position()[n]+"px":r):t}}})}),b.expr&&b.expr.filters&&(b.expr.filters.hidden=function(e){return 0>=e.offsetWidth&&0>=e.offsetHeight||!b.support.reliableHiddenOffsets&&"none"===(e.style&&e.style.display||b.css(e,"display"))},b.expr.filters.visible=function(e){return!b.expr.filters.hidden(e)}),b.each({margin:"",padding:"",border:"Width"},function(e,t){b.cssHooks[e+t]={expand:function(n){var r=0,i={},o="string"==typeof n?n.split(" "):[n];for(;4>r;r++)i[e+Zt[r]+t]=o[r]||o[r-2]||o[0];return i}},Ut.test(e)||(b.cssHooks[e+t].set=on)});var cn=/%20/g,pn=/\[\]$/,fn=/\r?\n/g,dn=/^(?:submit|button|image|reset|file)$/i,hn=/^(?:input|select|textarea|keygen)/i;b.fn.extend({serialize:function(){return b.param(this.serializeArray())},serializeArray:function(){return this.map(function(){var e=b.prop(this,"elements");return e?b.makeArray(e):this}).filter(function(){var e=this.type;return this.name&&!b(this).is(":disabled")&&hn.test(this.nodeName)&&!dn.test(e)&&(this.checked||!Nt.test(e))}).map(function(e,t){var n=b(this).val();return null==n?null:b.isArray(n)?b.map(n,function(e){return{name:t.name,value:e.replace(fn,"\r\n")}}):{name:t.name,value:n.replace(fn,"\r\n")}}).get()}}),b.param=function(e,n){var r,i=[],o=function(e,t){t=b.isFunction(t)?t():null==t?"":t,i[i.length]=encodeURIComponent(e)+"="+encodeURIComponent(t)};if(n===t&&(n=b.ajaxSettings&&b.ajaxSettings.traditional),b.isArray(e)||e.jquery&&!b.isPlainObject(e))b.each(e,function(){o(this.name,this.value)});else for(r in e)gn(r,e[r],n,o);return i.join("&").replace(cn,"+")};function gn(e,t,n,r){var i;if(b.isArray(t))b.each(t,function(t,i){n||pn.test(e)?r(e,i):gn(e+"["+("object"==typeof i?t:"")+"]",i,n,r)});else if(n||"object"!==b.type(t))r(e,t);else for(i in t)gn(e+"["+i+"]",t[i],n,r)}b.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "),function(e,t){b.fn[t]=function(e,n){return arguments.length>0?this.on(t,null,e,n):this.trigger(t)}}),b.fn.hover=function(e,t){return this.mouseenter(e).mouseleave(t||e)};var mn,yn,vn=b.now(),bn=/\?/,xn=/#.*$/,wn=/([?&])_=[^&]*/,Tn=/^(.*?):[ \t]*([^\r\n]*)\r?$/gm,Nn=/^(?:about|app|app-storage|.+-extension|file|res|widget):$/,Cn=/^(?:GET|HEAD)$/,kn=/^\/\//,En=/^([\w.+-]+:)(?:\/\/([^\/?#:]*)(?::(\d+)|)|)/,Sn=b.fn.load,An={},jn={},Dn="*/".concat("*");try{yn=a.href}catch(Ln){yn=o.createElement("a"),yn.href="",yn=yn.href}mn=En.exec(yn.toLowerCase())||[];function Hn(e){return function(t,n){"string"!=typeof t&&(n=t,t="*");var r,i=0,o=t.toLowerCase().match(w)||[];if(b.isFunction(n))while(r=o[i++])"+"===r[0]?(r=r.slice(1)||"*",(e[r]=e[r]||[]).unshift(n)):(e[r]=e[r]||[]).push(n)}}function qn(e,n,r,i){var o={},a=e===jn;function s(u){var l;return o[u]=!0,b.each(e[u]||[],function(e,u){var c=u(n,r,i);return"string"!=typeof c||a||o[c]?a?!(l=c):t:(n.dataTypes.unshift(c),s(c),!1)}),l}return s(n.dataTypes[0])||!o["*"]&&s("*")}function Mn(e,n){var r,i,o=b.ajaxSettings.flatOptions||{};for(i in n)n[i]!==t&&((o[i]?e:r||(r={}))[i]=n[i]);return r&&b.extend(!0,e,r),e}b.fn.load=function(e,n,r){if("string"!=typeof e&&Sn)return Sn.apply(this,arguments);var i,o,a,s=this,u=e.indexOf(" ");return u>=0&&(i=e.slice(u,e.length),e=e.slice(0,u)),b.isFunction(n)?(r=n,n=t):n&&"object"==typeof n&&(a="POST"),s.length>0&&b.ajax({url:e,type:a,dataType:"html",data:n}).done(function(e){o=arguments,s.html(i?b("<div>").append(b.parseHTML(e)).find(i):e)}).complete(r&&function(e,t){s.each(r,o||[e.responseText,t,e])}),this},b.each(["ajaxStart","ajaxStop","ajaxComplete","ajaxError","ajaxSuccess","ajaxSend"],function(e,t){b.fn[t]=function(e){return this.on(t,e)}}),b.each(["get","post"],function(e,n){b[n]=function(e,r,i,o){return b.isFunction(r)&&(o=o||i,i=r,r=t),b.ajax({url:e,type:n,dataType:o,data:r,success:i})}}),b.extend({active:0,lastModified:{},etag:{},ajaxSettings:{url:yn,type:"GET",isLocal:Nn.test(mn[1]),global:!0,processData:!0,async:!0,contentType:"application/x-www-form-urlencoded; charset=UTF-8",accepts:{"*":Dn,text:"text/plain",html:"text/html",xml:"application/xml, text/xml",json:"application/json, text/javascript"},contents:{xml:/xml/,html:/html/,json:/json/},responseFields:{xml:"responseXML",text:"responseText"},converters:{"* text":e.String,"text html":!0,"text json":b.parseJSON,"text xml":b.parseXML},flatOptions:{url:!0,context:!0}},ajaxSetup:function(e,t){return t?Mn(Mn(e,b.ajaxSettings),t):Mn(b.ajaxSettings,e)},ajaxPrefilter:Hn(An),ajaxTransport:Hn(jn),ajax:function(e,n){"object"==typeof e&&(n=e,e=t),n=n||{};var r,i,o,a,s,u,l,c,p=b.ajaxSetup({},n),f=p.context||p,d=p.context&&(f.nodeType||f.jquery)?b(f):b.event,h=b.Deferred(),g=b.Callbacks("once memory"),m=p.statusCode||{},y={},v={},x=0,T="canceled",N={readyState:0,getResponseHeader:function(e){var t;if(2===x){if(!c){c={};while(t=Tn.exec(a))c[t[1].toLowerCase()]=t[2]}t=c[e.toLowerCase()]}return null==t?null:t},getAllResponseHeaders:function(){return 2===x?a:null},setRequestHeader:function(e,t){var n=e.toLowerCase();return x||(e=v[n]=v[n]||e,y[e]=t),this},overrideMimeType:function(e){return x||(p.mimeType=e),this},statusCode:function(e){var t;if(e)if(2>x)for(t in e)m[t]=[m[t],e[t]];else N.always(e[N.status]);return this},abort:function(e){var t=e||T;return l&&l.abort(t),k(0,t),this}};if(h.promise(N).complete=g.add,N.success=N.done,N.error=N.fail,p.url=((e||p.url||yn)+"").replace(xn,"").replace(kn,mn[1]+"//"),p.type=n.method||n.type||p.method||p.type,p.dataTypes=b.trim(p.dataType||"*").toLowerCase().match(w)||[""],null==p.crossDomain&&(r=En.exec(p.url.toLowerCase()),p.crossDomain=!(!r||r[1]===mn[1]&&r[2]===mn[2]&&(r[3]||("http:"===r[1]?80:443))==(mn[3]||("http:"===mn[1]?80:443)))),p.data&&p.processData&&"string"!=typeof p.data&&(p.data=b.param(p.data,p.traditional)),qn(An,p,n,N),2===x)return N;u=p.global,u&&0===b.active++&&b.event.trigger("ajaxStart"),p.type=p.type.toUpperCase(),p.hasContent=!Cn.test(p.type),o=p.url,p.hasContent||(p.data&&(o=p.url+=(bn.test(o)?"&":"?")+p.data,delete p.data),p.cache===!1&&(p.url=wn.test(o)?o.replace(wn,"$1_="+vn++):o+(bn.test(o)?"&":"?")+"_="+vn++)),p.ifModified&&(b.lastModified[o]&&N.setRequestHeader("If-Modified-Since",b.lastModified[o]),b.etag[o]&&N.setRequestHeader("If-None-Match",b.etag[o])),(p.data&&p.hasContent&&p.contentType!==!1||n.contentType)&&N.setRequestHeader("Content-Type",p.contentType),N.setRequestHeader("Accept",p.dataTypes[0]&&p.accepts[p.dataTypes[0]]?p.accepts[p.dataTypes[0]]+("*"!==p.dataTypes[0]?", "+Dn+"; q=0.01":""):p.accepts["*"]);for(i in p.headers)N.setRequestHeader(i,p.headers[i]);if(p.beforeSend&&(p.beforeSend.call(f,N,p)===!1||2===x))return N.abort();T="abort";for(i in{success:1,error:1,complete:1})N[i](p[i]);if(l=qn(jn,p,n,N)){N.readyState=1,u&&d.trigger("ajaxSend",[N,p]),p.async&&p.timeout>0&&(s=setTimeout(function(){N.abort("timeout")},p.timeout));try{x=1,l.send(y,k)}catch(C){if(!(2>x))throw C;k(-1,C)}}else k(-1,"No Transport");function k(e,n,r,i){var c,y,v,w,T,C=n;2!==x&&(x=2,s&&clearTimeout(s),l=t,a=i||"",N.readyState=e>0?4:0,r&&(w=_n(p,N,r)),e>=200&&300>e||304===e?(p.ifModified&&(T=N.getResponseHeader("Last-Modified"),T&&(b.lastModified[o]=T),T=N.getResponseHeader("etag"),T&&(b.etag[o]=T)),204===e?(c=!0,C="nocontent"):304===e?(c=!0,C="notmodified"):(c=Fn(p,w),C=c.state,y=c.data,v=c.error,c=!v)):(v=C,(e||!C)&&(C="error",0>e&&(e=0))),N.status=e,N.statusText=(n||C)+"",c?h.resolveWith(f,[y,C,N]):h.rejectWith(f,[N,C,v]),N.statusCode(m),m=t,u&&d.trigger(c?"ajaxSuccess":"ajaxError",[N,p,c?y:v]),g.fireWith(f,[N,C]),u&&(d.trigger("ajaxComplete",[N,p]),--b.active||b.event.trigger("ajaxStop")))}return N},getScript:function(e,n){return b.get(e,t,n,"script")},getJSON:function(e,t,n){return b.get(e,t,n,"json")}});function _n(e,n,r){var i,o,a,s,u=e.contents,l=e.dataTypes,c=e.responseFields;for(s in c)s in r&&(n[c[s]]=r[s]);while("*"===l[0])l.shift(),o===t&&(o=e.mimeType||n.getResponseHeader("Content-Type"));if(o)for(s in u)if(u[s]&&u[s].test(o)){l.unshift(s);break}if(l[0]in r)a=l[0];else{for(s in r){if(!l[0]||e.converters[s+" "+l[0]]){a=s;break}i||(i=s)}a=a||i}return a?(a!==l[0]&&l.unshift(a),r[a]):t}function Fn(e,t){var n,r,i,o,a={},s=0,u=e.dataTypes.slice(),l=u[0];if(e.dataFilter&&(t=e.dataFilter(t,e.dataType)),u[1])for(i in e.converters)a[i.toLowerCase()]=e.converters[i];for(;r=u[++s];)if("*"!==r){if("*"!==l&&l!==r){if(i=a[l+" "+r]||a["* "+r],!i)for(n in a)if(o=n.split(" "),o[1]===r&&(i=a[l+" "+o[0]]||a["* "+o[0]])){i===!0?i=a[n]:a[n]!==!0&&(r=o[0],u.splice(s--,0,r));break}if(i!==!0)if(i&&e["throws"])t=i(t);else try{t=i(t)}catch(c){return{state:"parsererror",error:i?c:"No conversion from "+l+" to "+r}}}l=r}return{state:"success",data:t}}b.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/(?:java|ecma)script/},converters:{"text script":function(e){return b.globalEval(e),e}}}),b.ajaxPrefilter("script",function(e){e.cache===t&&(e.cache=!1),e.crossDomain&&(e.type="GET",e.global=!1)}),b.ajaxTransport("script",function(e){if(e.crossDomain){var n,r=o.head||b("head")[0]||o.documentElement;return{send:function(t,i){n=o.createElement("script"),n.async=!0,e.scriptCharset&&(n.charset=e.scriptCharset),n.src=e.url,n.onload=n.onreadystatechange=function(e,t){(t||!n.readyState||/loaded|complete/.test(n.readyState))&&(n.onload=n.onreadystatechange=null,n.parentNode&&n.parentNode.removeChild(n),n=null,t||i(200,"success"))},r.insertBefore(n,r.firstChild)},abort:function(){n&&n.onload(t,!0)}}}});var On=[],Bn=/(=)\?(?=&|$)|\?\?/;b.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var e=On.pop()||b.expando+"_"+vn++;return this[e]=!0,e}}),b.ajaxPrefilter("json jsonp",function(n,r,i){var o,a,s,u=n.jsonp!==!1&&(Bn.test(n.url)?"url":"string"==typeof n.data&&!(n.contentType||"").indexOf("application/x-www-form-urlencoded")&&Bn.test(n.data)&&"data");return u||"jsonp"===n.dataTypes[0]?(o=n.jsonpCallback=b.isFunction(n.jsonpCallback)?n.jsonpCallback():n.jsonpCallback,u?n[u]=n[u].replace(Bn,"$1"+o):n.jsonp!==!1&&(n.url+=(bn.test(n.url)?"&":"?")+n.jsonp+"="+o),n.converters["script json"]=function(){return s||b.error(o+" was not called"),s[0]},n.dataTypes[0]="json",a=e[o],e[o]=function(){s=arguments},i.always(function(){e[o]=a,n[o]&&(n.jsonpCallback=r.jsonpCallback,On.push(o)),s&&b.isFunction(a)&&a(s[0]),s=a=t}),"script"):t});var Pn,Rn,Wn=0,$n=e.ActiveXObject&&function(){var e;for(e in Pn)Pn[e](t,!0)};function In(){try{return new e.XMLHttpRequest}catch(t){}}function zn(){try{return new e.ActiveXObject("Microsoft.XMLHTTP")}catch(t){}}b.ajaxSettings.xhr=e.ActiveXObject?function(){return!this.isLocal&&In()||zn()}:In,Rn=b.ajaxSettings.xhr(),b.support.cors=!!Rn&&"withCredentials"in Rn,Rn=b.support.ajax=!!Rn,Rn&&b.ajaxTransport(function(n){if(!n.crossDomain||b.support.cors){var r;return{send:function(i,o){var a,s,u=n.xhr();if(n.username?u.open(n.type,n.url,n.async,n.username,n.password):u.open(n.type,n.url,n.async),n.xhrFields)for(s in n.xhrFields)u[s]=n.xhrFields[s];n.mimeType&&u.overrideMimeType&&u.overrideMimeType(n.mimeType),n.crossDomain||i["X-Requested-With"]||(i["X-Requested-With"]="XMLHttpRequest");try{for(s in i)u.setRequestHeader(s,i[s])}catch(l){}u.send(n.hasContent&&n.data||null),r=function(e,i){var s,l,c,p;try{if(r&&(i||4===u.readyState))if(r=t,a&&(u.onreadystatechange=b.noop,$n&&delete Pn[a]),i)4!==u.readyState&&u.abort();else{p={},s=u.status,l=u.getAllResponseHeaders(),"string"==typeof u.responseText&&(p.text=u.responseText);try{c=u.statusText}catch(f){c=""}s||!n.isLocal||n.crossDomain?1223===s&&(s=204):s=p.text?200:404}}catch(d){i||o(-1,d)}p&&o(s,c,p,l)},n.async?4===u.readyState?setTimeout(r):(a=++Wn,$n&&(Pn||(Pn={},b(e).unload($n)),Pn[a]=r),u.onreadystatechange=r):r()},abort:function(){r&&r(t,!0)}}}});var Xn,Un,Vn=/^(?:toggle|show|hide)$/,Yn=RegExp("^(?:([+-])=|)("+x+")([a-z%]*)$","i"),Jn=/queueHooks$/,Gn=[nr],Qn={"*":[function(e,t){var n,r,i=this.createTween(e,t),o=Yn.exec(t),a=i.cur(),s=+a||0,u=1,l=20;if(o){if(n=+o[2],r=o[3]||(b.cssNumber[e]?"":"px"),"px"!==r&&s){s=b.css(i.elem,e,!0)||n||1;do u=u||".5",s/=u,b.style(i.elem,e,s+r);while(u!==(u=i.cur()/a)&&1!==u&&--l)}i.unit=r,i.start=s,i.end=o[1]?s+(o[1]+1)*n:n}return i}]};function Kn(){return setTimeout(function(){Xn=t}),Xn=b.now()}function Zn(e,t){b.each(t,function(t,n){var r=(Qn[t]||[]).concat(Qn["*"]),i=0,o=r.length;for(;o>i;i++)if(r[i].call(e,t,n))return})}function er(e,t,n){var r,i,o=0,a=Gn.length,s=b.Deferred().always(function(){delete u.elem}),u=function(){if(i)return!1;var t=Xn||Kn(),n=Math.max(0,l.startTime+l.duration-t),r=n/l.duration||0,o=1-r,a=0,u=l.tweens.length;for(;u>a;a++)l.tweens[a].run(o);return s.notifyWith(e,[l,o,n]),1>o&&u?n:(s.resolveWith(e,[l]),!1)},l=s.promise({elem:e,props:b.extend({},t),opts:b.extend(!0,{specialEasing:{}},n),originalProperties:t,originalOptions:n,startTime:Xn||Kn(),duration:n.duration,tweens:[],createTween:function(t,n){var r=b.Tween(e,l.opts,t,n,l.opts.specialEasing[t]||l.opts.easing);return l.tweens.push(r),r},stop:function(t){var n=0,r=t?l.tweens.length:0;if(i)return this;for(i=!0;r>n;n++)l.tweens[n].run(1);return t?s.resolveWith(e,[l,t]):s.rejectWith(e,[l,t]),this}}),c=l.props;for(tr(c,l.opts.specialEasing);a>o;o++)if(r=Gn[o].call(l,e,c,l.opts))return r;return Zn(l,c),b.isFunction(l.opts.start)&&l.opts.start.call(e,l),b.fx.timer(b.extend(u,{elem:e,anim:l,queue:l.opts.queue})),l.progress(l.opts.progress).done(l.opts.done,l.opts.complete).fail(l.opts.fail).always(l.opts.always)}function tr(e,t){var n,r,i,o,a;for(i in e)if(r=b.camelCase(i),o=t[r],n=e[i],b.isArray(n)&&(o=n[1],n=e[i]=n[0]),i!==r&&(e[r]=n,delete e[i]),a=b.cssHooks[r],a&&"expand"in a){n=a.expand(n),delete e[r];for(i in n)i in e||(e[i]=n[i],t[i]=o)}else t[r]=o}b.Animation=b.extend(er,{tweener:function(e,t){b.isFunction(e)?(t=e,e=["*"]):e=e.split(" ");var n,r=0,i=e.length;for(;i>r;r++)n=e[r],Qn[n]=Qn[n]||[],Qn[n].unshift(t)},prefilter:function(e,t){t?Gn.unshift(e):Gn.push(e)}});function nr(e,t,n){var r,i,o,a,s,u,l,c,p,f=this,d=e.style,h={},g=[],m=e.nodeType&&nn(e);n.queue||(c=b._queueHooks(e,"fx"),null==c.unqueued&&(c.unqueued=0,p=c.empty.fire,c.empty.fire=function(){c.unqueued||p()}),c.unqueued++,f.always(function(){f.always(function(){c.unqueued--,b.queue(e,"fx").length||c.empty.fire()})})),1===e.nodeType&&("height"in t||"width"in t)&&(n.overflow=[d.overflow,d.overflowX,d.overflowY],"inline"===b.css(e,"display")&&"none"===b.css(e,"float")&&(b.support.inlineBlockNeedsLayout&&"inline"!==un(e.nodeName)?d.zoom=1:d.display="inline-block")),n.overflow&&(d.overflow="hidden",b.support.shrinkWrapBlocks||f.always(function(){d.overflow=n.overflow[0],d.overflowX=n.overflow[1],d.overflowY=n.overflow[2]}));for(i in t)if(a=t[i],Vn.exec(a)){if(delete t[i],u=u||"toggle"===a,a===(m?"hide":"show"))continue;g.push(i)}if(o=g.length){s=b._data(e,"fxshow")||b._data(e,"fxshow",{}),"hidden"in s&&(m=s.hidden),u&&(s.hidden=!m),m?b(e).show():f.done(function(){b(e).hide()}),f.done(function(){var t;b._removeData(e,"fxshow");for(t in h)b.style(e,t,h[t])});for(i=0;o>i;i++)r=g[i],l=f.createTween(r,m?s[r]:0),h[r]=s[r]||b.style(e,r),r in s||(s[r]=l.start,m&&(l.end=l.start,l.start="width"===r||"height"===r?1:0))}}function rr(e,t,n,r,i){return new rr.prototype.init(e,t,n,r,i)}b.Tween=rr,rr.prototype={constructor:rr,init:function(e,t,n,r,i,o){this.elem=e,this.prop=n,this.easing=i||"swing",this.options=t,this.start=this.now=this.cur(),this.end=r,this.unit=o||(b.cssNumber[n]?"":"px")},cur:function(){var e=rr.propHooks[this.prop];return e&&e.get?e.get(this):rr.propHooks._default.get(this)},run:function(e){var t,n=rr.propHooks[this.prop];return this.pos=t=this.options.duration?b.easing[this.easing](e,this.options.duration*e,0,1,this.options.duration):e,this.now=(this.end-this.start)*t+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),n&&n.set?n.set(this):rr.propHooks._default.set(this),this}},rr.prototype.init.prototype=rr.prototype,rr.propHooks={_default:{get:function(e){var t;return null==e.elem[e.prop]||e.elem.style&&null!=e.elem.style[e.prop]?(t=b.css(e.elem,e.prop,""),t&&"auto"!==t?t:0):e.elem[e.prop]},set:function(e){b.fx.step[e.prop]?b.fx.step[e.prop](e):e.elem.style&&(null!=e.elem.style[b.cssProps[e.prop]]||b.cssHooks[e.prop])?b.style(e.elem,e.prop,e.now+e.unit):e.elem[e.prop]=e.now}}},rr.propHooks.scrollTop=rr.propHooks.scrollLeft={set:function(e){e.elem.nodeType&&e.elem.parentNode&&(e.elem[e.prop]=e.now)}},b.each(["toggle","show","hide"],function(e,t){var n=b.fn[t];b.fn[t]=function(e,r,i){return null==e||"boolean"==typeof e?n.apply(this,arguments):this.animate(ir(t,!0),e,r,i)}}),b.fn.extend({fadeTo:function(e,t,n,r){return this.filter(nn).css("opacity",0).show().end().animate({opacity:t},e,n,r)},animate:function(e,t,n,r){var i=b.isEmptyObject(e),o=b.speed(t,n,r),a=function(){var t=er(this,b.extend({},e),o);a.finish=function(){t.stop(!0)},(i||b._data(this,"finish"))&&t.stop(!0)};return a.finish=a,i||o.queue===!1?this.each(a):this.queue(o.queue,a)},stop:function(e,n,r){var i=function(e){var t=e.stop;delete e.stop,t(r)};return"string"!=typeof e&&(r=n,n=e,e=t),n&&e!==!1&&this.queue(e||"fx",[]),this.each(function(){var t=!0,n=null!=e&&e+"queueHooks",o=b.timers,a=b._data(this);if(n)a[n]&&a[n].stop&&i(a[n]);else for(n in a)a[n]&&a[n].stop&&Jn.test(n)&&i(a[n]);for(n=o.length;n--;)o[n].elem!==this||null!=e&&o[n].queue!==e||(o[n].anim.stop(r),t=!1,o.splice(n,1));(t||!r)&&b.dequeue(this,e)})},finish:function(e){return e!==!1&&(e=e||"fx"),this.each(function(){var t,n=b._data(this),r=n[e+"queue"],i=n[e+"queueHooks"],o=b.timers,a=r?r.length:0;for(n.finish=!0,b.queue(this,e,[]),i&&i.cur&&i.cur.finish&&i.cur.finish.call(this),t=o.length;t--;)o[t].elem===this&&o[t].queue===e&&(o[t].anim.stop(!0),o.splice(t,1));for(t=0;a>t;t++)r[t]&&r[t].finish&&r[t].finish.call(this);delete n.finish})}});function ir(e,t){var n,r={height:e},i=0;for(t=t?1:0;4>i;i+=2-t)n=Zt[i],r["margin"+n]=r["padding"+n]=e;return t&&(r.opacity=r.width=e),r}b.each({slideDown:ir("show"),slideUp:ir("hide"),slideToggle:ir("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(e,t){b.fn[e]=function(e,n,r){return this.animate(t,e,n,r)}}),b.speed=function(e,t,n){var r=e&&"object"==typeof e?b.extend({},e):{complete:n||!n&&t||b.isFunction(e)&&e,duration:e,easing:n&&t||t&&!b.isFunction(t)&&t};return r.duration=b.fx.off?0:"number"==typeof r.duration?r.duration:r.duration in b.fx.speeds?b.fx.speeds[r.duration]:b.fx.speeds._default,(null==r.queue||r.queue===!0)&&(r.queue="fx"),r.old=r.complete,r.complete=function(){b.isFunction(r.old)&&r.old.call(this),r.queue&&b.dequeue(this,r.queue)},r},b.easing={linear:function(e){return e},swing:function(e){return.5-Math.cos(e*Math.PI)/2}},b.timers=[],b.fx=rr.prototype.init,b.fx.tick=function(){var e,n=b.timers,r=0;for(Xn=b.now();n.length>r;r++)e=n[r],e()||n[r]!==e||n.splice(r--,1);n.length||b.fx.stop(),Xn=t},b.fx.timer=function(e){e()&&b.timers.push(e)&&b.fx.start()},b.fx.interval=13,b.fx.start=function(){Un||(Un=setInterval(b.fx.tick,b.fx.interval))},b.fx.stop=function(){clearInterval(Un),Un=null},b.fx.speeds={slow:600,fast:200,_default:400},b.fx.step={},b.expr&&b.expr.filters&&(b.expr.filters.animated=function(e){return b.grep(b.timers,function(t){return e===t.elem}).length}),b.fn.offset=function(e){if(arguments.length)return e===t?this:this.each(function(t){b.offset.setOffset(this,e,t)});var n,r,o={top:0,left:0},a=this[0],s=a&&a.ownerDocument;if(s)return n=s.documentElement,b.contains(n,a)?(typeof a.getBoundingClientRect!==i&&(o=a.getBoundingClientRect()),r=or(s),{top:o.top+(r.pageYOffset||n.scrollTop)-(n.clientTop||0),left:o.left+(r.pageXOffset||n.scrollLeft)-(n.clientLeft||0)}):o},b.offset={setOffset:function(e,t,n){var r=b.css(e,"position");"static"===r&&(e.style.position="relative");var i=b(e),o=i.offset(),a=b.css(e,"top"),s=b.css(e,"left"),u=("absolute"===r||"fixed"===r)&&b.inArray("auto",[a,s])>-1,l={},c={},p,f;u?(c=i.position(),p=c.top,f=c.left):(p=parseFloat(a)||0,f=parseFloat(s)||0),b.isFunction(t)&&(t=t.call(e,n,o)),null!=t.top&&(l.top=t.top-o.top+p),null!=t.left&&(l.left=t.left-o.left+f),"using"in t?t.using.call(e,l):i.css(l)}},b.fn.extend({position:function(){if(this[0]){var e,t,n={top:0,left:0},r=this[0];return"fixed"===b.css(r,"position")?t=r.getBoundingClientRect():(e=this.offsetParent(),t=this.offset(),b.nodeName(e[0],"html")||(n=e.offset()),n.top+=b.css(e[0],"borderTopWidth",!0),n.left+=b.css(e[0],"borderLeftWidth",!0)),{top:t.top-n.top-b.css(r,"marginTop",!0),left:t.left-n.left-b.css(r,"marginLeft",!0)}}},offsetParent:function(){return this.map(function(){var e=this.offsetParent||o.documentElement;while(e&&!b.nodeName(e,"html")&&"static"===b.css(e,"position"))e=e.offsetParent;return e||o.documentElement})}}),b.each({scrollLeft:"pageXOffset",scrollTop:"pageYOffset"},function(e,n){var r=/Y/.test(n);b.fn[e]=function(i){return b.access(this,function(e,i,o){var a=or(e);return o===t?a?n in a?a[n]:a.document.documentElement[i]:e[i]:(a?a.scrollTo(r?b(a).scrollLeft():o,r?o:b(a).scrollTop()):e[i]=o,t)},e,i,arguments.length,null)}});function or(e){return b.isWindow(e)?e:9===e.nodeType?e.defaultView||e.parentWindow:!1}b.each({Height:"height",Width:"width"},function(e,n){b.each({padding:"inner"+e,content:n,"":"outer"+e},function(r,i){b.fn[i]=function(i,o){var a=arguments.length&&(r||"boolean"!=typeof i),s=r||(i===!0||o===!0?"margin":"border");return b.access(this,function(n,r,i){var o;return b.isWindow(n)?n.document.documentElement["client"+e]:9===n.nodeType?(o=n.documentElement,Math.max(n.body["scroll"+e],o["scroll"+e],n.body["offset"+e],o["offset"+e],o["client"+e])):i===t?b.css(n,r,s):b.style(n,r,i,s)},n,a?i:t,a,null)}})}),e.jQuery=e.$=b,"function"==typeof define&&define.amd&&define.amd.jQuery&&define("jquery",[],function(){return b})})(window);
/*global define:false */
/**
 * Copyright 2013 Craig Campbell
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Mousetrap is a simple keyboard shortcut library for Javascript with
 * no external dependencies
 *
 * @version 1.4.6
 * @url craig.is/killing/mice
 */
(function(window, document, undefined) {

    /**
     * mapping of special keycodes to their corresponding keys
     *
     * everything in this dictionary cannot use keypress events
     * so it has to be here to map to the correct keycodes for
     * keyup/keydown events
     *
     * @type {Object}
     */
    var _MAP = {
            8: 'backspace',
            9: 'tab',
            13: 'enter',
            16: 'shift',
            17: 'ctrl',
            18: 'alt',
            20: 'capslock',
            27: 'esc',
            32: 'space',
            33: 'pageup',
            34: 'pagedown',
            35: 'end',
            36: 'home',
            37: 'left',
            38: 'up',
            39: 'right',
            40: 'down',
            45: 'ins',
            46: 'del',
            91: 'meta',
            93: 'meta',
            224: 'meta'
        },

        /**
         * mapping for special characters so they can support
         *
         * this dictionary is only used incase you want to bind a
         * keyup or keydown event to one of these keys
         *
         * @type {Object}
         */
        _KEYCODE_MAP = {
            106: '*',
            107: '+',
            109: '-',
            110: '.',
            111 : '/',
            186: ';',
            187: '=',
            188: ',',
            189: '-',
            190: '.',
            191: '/',
            192: '`',
            219: '[',
            220: '\\',
            221: ']',
            222: '\''
        },

        /**
         * this is a mapping of keys that require shift on a US keypad
         * back to the non shift equivelents
         *
         * this is so you can use keyup events with these keys
         *
         * note that this will only work reliably on US keyboards
         *
         * @type {Object}
         */
        _SHIFT_MAP = {
            '~': '`',
            '!': '1',
            '@': '2',
            '#': '3',
            '$': '4',
            '%': '5',
            '^': '6',
            '&': '7',
            '*': '8',
            '(': '9',
            ')': '0',
            '_': '-',
            '+': '=',
            ':': ';',
            '\"': '\'',
            '<': ',',
            '>': '.',
            '?': '/',
            '|': '\\'
        },

        /**
         * this is a list of special strings you can use to map
         * to modifier keys when you specify your keyboard shortcuts
         *
         * @type {Object}
         */
        _SPECIAL_ALIASES = {
            'option': 'alt',
            'command': 'meta',
            'return': 'enter',
            'escape': 'esc',
            'mod': /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'meta' : 'ctrl'
        },

        /**
         * variable to store the flipped version of _MAP from above
         * needed to check if we should use keypress or not when no action
         * is specified
         *
         * @type {Object|undefined}
         */
        _REVERSE_MAP,

        /**
         * a list of all the callbacks setup via Mousetrap.bind()
         *
         * @type {Object}
         */
        _callbacks = {},

        /**
         * direct map of string combinations to callbacks used for trigger()
         *
         * @type {Object}
         */
        _directMap = {},

        /**
         * keeps track of what level each sequence is at since multiple
         * sequences can start out with the same sequence
         *
         * @type {Object}
         */
        _sequenceLevels = {},

        /**
         * variable to store the setTimeout call
         *
         * @type {null|number}
         */
        _resetTimer,

        /**
         * temporary state where we will ignore the next keyup
         *
         * @type {boolean|string}
         */
        _ignoreNextKeyup = false,

        /**
         * temporary state where we will ignore the next keypress
         *
         * @type {boolean}
         */
        _ignoreNextKeypress = false,

        /**
         * are we currently inside of a sequence?
         * type of action ("keyup" or "keydown" or "keypress") or false
         *
         * @type {boolean|string}
         */
        _nextExpectedAction = false;

    /**
     * loop through the f keys, f1 to f19 and add them to the map
     * programatically
     */
    for (var i = 1; i < 20; ++i) {
        _MAP[111 + i] = 'f' + i;
    }

    /**
     * loop through to map numbers on the numeric keypad
     */
    for (i = 0; i <= 9; ++i) {
        _MAP[i + 96] = i;
    }

    /**
     * cross browser add event method
     *
     * @param {Element|HTMLDocument} object
     * @param {string} type
     * @param {Function} callback
     * @returns void
     */
    function _addEvent(object, type, callback) {
        if (object.addEventListener) {
            object.addEventListener(type, callback, false);
            return;
        }

        object.attachEvent('on' + type, callback);
    }

    /**
     * takes the event and returns the key character
     *
     * @param {Event} e
     * @return {string}
     */
    function _characterFromEvent(e) {

        // for keypress events we should return the character as is
        if (e.type == 'keypress') {
            var character = String.fromCharCode(e.which);

            // if the shift key is not pressed then it is safe to assume
            // that we want the character to be lowercase.  this means if
            // you accidentally have caps lock on then your key bindings
            // will continue to work
            //
            // the only side effect that might not be desired is if you
            // bind something like 'A' cause you want to trigger an
            // event when capital A is pressed caps lock will no longer
            // trigger the event.  shift+a will though.
            if (!e.shiftKey) {
                character = character.toLowerCase();
            }

            return character;
        }

        // for non keypress events the special maps are needed
        if (_MAP[e.which]) {
            return _MAP[e.which];
        }

        if (_KEYCODE_MAP[e.which]) {
            return _KEYCODE_MAP[e.which];
        }

        // if it is not in the special map

        // with keydown and keyup events the character seems to always
        // come in as an uppercase character whether you are pressing shift
        // or not.  we should make sure it is always lowercase for comparisons
        return String.fromCharCode(e.which).toLowerCase();
    }

    /**
     * checks if two arrays are equal
     *
     * @param {Array} modifiers1
     * @param {Array} modifiers2
     * @returns {boolean}
     */
    function _modifiersMatch(modifiers1, modifiers2) {
        return modifiers1.sort().join(',') === modifiers2.sort().join(',');
    }

    /**
     * resets all sequence counters except for the ones passed in
     *
     * @param {Object} doNotReset
     * @returns void
     */
    function _resetSequences(doNotReset) {
        doNotReset = doNotReset || {};

        var activeSequences = false,
            key;

        for (key in _sequenceLevels) {
            if (doNotReset[key]) {
                activeSequences = true;
                continue;
            }
            _sequenceLevels[key] = 0;
        }

        if (!activeSequences) {
            _nextExpectedAction = false;
        }
    }

    /**
     * finds all callbacks that match based on the keycode, modifiers,
     * and action
     *
     * @param {string} character
     * @param {Array} modifiers
     * @param {Event|Object} e
     * @param {string=} sequenceName - name of the sequence we are looking for
     * @param {string=} combination
     * @param {number=} level
     * @returns {Array}
     */
    function _getMatches(character, modifiers, e, sequenceName, combination, level) {
        var i,
            callback,
            matches = [],
            action = e.type;

        // if there are no events related to this keycode
        if (!_callbacks[character]) {
            return [];
        }

        // if a modifier key is coming up on its own we should allow it
        if (action == 'keyup' && _isModifier(character)) {
            modifiers = [character];
        }

        // loop through all callbacks for the key that was pressed
        // and see if any of them match
        for (i = 0; i < _callbacks[character].length; ++i) {
            callback = _callbacks[character][i];

            // if a sequence name is not specified, but this is a sequence at
            // the wrong level then move onto the next match
            if (!sequenceName && callback.seq && _sequenceLevels[callback.seq] != callback.level) {
                continue;
            }

            // if the action we are looking for doesn't match the action we got
            // then we should keep going
            if (action != callback.action) {
                continue;
            }

            // if this is a keypress event and the meta key and control key
            // are not pressed that means that we need to only look at the
            // character, otherwise check the modifiers as well
            //
            // chrome will not fire a keypress if meta or control is down
            // safari will fire a keypress if meta or meta+shift is down
            // firefox will fire a keypress if meta or control is down
            if ((action == 'keypress' && !e.metaKey && !e.ctrlKey) || _modifiersMatch(modifiers, callback.modifiers)) {

                // when you bind a combination or sequence a second time it
                // should overwrite the first one.  if a sequenceName or
                // combination is specified in this call it does just that
                //
                // @todo make deleting its own method?
                var deleteCombo = !sequenceName && callback.combo == combination;
                var deleteSequence = sequenceName && callback.seq == sequenceName && callback.level == level;
                if (deleteCombo || deleteSequence) {
                    _callbacks[character].splice(i, 1);
                }

                matches.push(callback);
            }
        }

        return matches;
    }

    /**
     * takes a key event and figures out what the modifiers are
     *
     * @param {Event} e
     * @returns {Array}
     */
    function _eventModifiers(e) {
        var modifiers = [];

        if (e.shiftKey) {
            modifiers.push('shift');
        }

        if (e.altKey) {
            modifiers.push('alt');
        }

        if (e.ctrlKey) {
            modifiers.push('ctrl');
        }

        if (e.metaKey) {
            modifiers.push('meta');
        }

        return modifiers;
    }

    /**
     * prevents default for this event
     *
     * @param {Event} e
     * @returns void
     */
    function _preventDefault(e) {
        if (e.preventDefault) {
            e.preventDefault();
            return;
        }

        e.returnValue = false;
    }

    /**
     * stops propogation for this event
     *
     * @param {Event} e
     * @returns void
     */
    function _stopPropagation(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
            return;
        }

        e.cancelBubble = true;
    }

    /**
     * actually calls the callback function
     *
     * if your callback function returns false this will use the jquery
     * convention - prevent default and stop propogation on the event
     *
     * @param {Function} callback
     * @param {Event} e
     * @returns void
     */
    function _fireCallback(callback, e, combo, sequence) {

        // if this event should not happen stop here
        if (Mousetrap.stopCallback(e, e.target || e.srcElement, combo, sequence)) {
            return;
        }

        if (callback(e, combo) === false) {
            _preventDefault(e);
            _stopPropagation(e);
        }
    }

    /**
     * handles a character key event
     *
     * @param {string} character
     * @param {Array} modifiers
     * @param {Event} e
     * @returns void
     */
    function _handleKey(character, modifiers, e) {
        var callbacks = _getMatches(character, modifiers, e),
            i,
            doNotReset = {},
            maxLevel = 0,
            processedSequenceCallback = false;

        // Calculate the maxLevel for sequences so we can only execute the longest callback sequence
        for (i = 0; i < callbacks.length; ++i) {
            if (callbacks[i].seq) {
                maxLevel = Math.max(maxLevel, callbacks[i].level);
            }
        }

        // loop through matching callbacks for this key event
        for (i = 0; i < callbacks.length; ++i) {

            // fire for all sequence callbacks
            // this is because if for example you have multiple sequences
            // bound such as "g i" and "g t" they both need to fire the
            // callback for matching g cause otherwise you can only ever
            // match the first one
            if (callbacks[i].seq) {

                // only fire callbacks for the maxLevel to prevent
                // subsequences from also firing
                //
                // for example 'a option b' should not cause 'option b' to fire
                // even though 'option b' is part of the other sequence
                //
                // any sequences that do not match here will be discarded
                // below by the _resetSequences call
                if (callbacks[i].level != maxLevel) {
                    continue;
                }

                processedSequenceCallback = true;

                // keep a list of which sequences were matches for later
                doNotReset[callbacks[i].seq] = 1;
                _fireCallback(callbacks[i].callback, e, callbacks[i].combo, callbacks[i].seq);
                continue;
            }

            // if there were no sequence matches but we are still here
            // that means this is a regular match so we should fire that
            if (!processedSequenceCallback) {
                _fireCallback(callbacks[i].callback, e, callbacks[i].combo);
            }
        }

        // if the key you pressed matches the type of sequence without
        // being a modifier (ie "keyup" or "keypress") then we should
        // reset all sequences that were not matched by this event
        //
        // this is so, for example, if you have the sequence "h a t" and you
        // type "h e a r t" it does not match.  in this case the "e" will
        // cause the sequence to reset
        //
        // modifier keys are ignored because you can have a sequence
        // that contains modifiers such as "enter ctrl+space" and in most
        // cases the modifier key will be pressed before the next key
        //
        // also if you have a sequence such as "ctrl+b a" then pressing the
        // "b" key will trigger a "keypress" and a "keydown"
        //
        // the "keydown" is expected when there is a modifier, but the
        // "keypress" ends up matching the _nextExpectedAction since it occurs
        // after and that causes the sequence to reset
        //
        // we ignore keypresses in a sequence that directly follow a keydown
        // for the same character
        var ignoreThisKeypress = e.type == 'keypress' && _ignoreNextKeypress;
        if (e.type == _nextExpectedAction && !_isModifier(character) && !ignoreThisKeypress) {
            _resetSequences(doNotReset);
        }

        _ignoreNextKeypress = processedSequenceCallback && e.type == 'keydown';
    }

    /**
     * handles a keydown event
     *
     * @param {Event} e
     * @returns void
     */
    function _handleKeyEvent(e) {

        // normalize e.which for key events
        // @see http://stackoverflow.com/questions/4285627/javascript-keycode-vs-charcode-utter-confusion
        if (typeof e.which !== 'number') {
            e.which = e.keyCode;
        }

        var character = _characterFromEvent(e);

        // no character found then stop
        if (!character) {
            return;
        }

        // need to use === for the character check because the character can be 0
        if (e.type == 'keyup' && _ignoreNextKeyup === character) {
            _ignoreNextKeyup = false;
            return;
        }

        Mousetrap.handleKey(character, _eventModifiers(e), e);
    }

    /**
     * determines if the keycode specified is a modifier key or not
     *
     * @param {string} key
     * @returns {boolean}
     */
    function _isModifier(key) {
        return key == 'shift' || key == 'ctrl' || key == 'alt' || key == 'meta';
    }

    /**
     * called to set a 1 second timeout on the specified sequence
     *
     * this is so after each key press in the sequence you have 1 second
     * to press the next key before you have to start over
     *
     * @returns void
     */
    function _resetSequenceTimer() {
        clearTimeout(_resetTimer);
        _resetTimer = setTimeout(_resetSequences, 1000);
    }

    /**
     * reverses the map lookup so that we can look for specific keys
     * to see what can and can't use keypress
     *
     * @return {Object}
     */
    function _getReverseMap() {
        if (!_REVERSE_MAP) {
            _REVERSE_MAP = {};
            for (var key in _MAP) {

                // pull out the numeric keypad from here cause keypress should
                // be able to detect the keys from the character
                if (key > 95 && key < 112) {
                    continue;
                }

                if (_MAP.hasOwnProperty(key)) {
                    _REVERSE_MAP[_MAP[key]] = key;
                }
            }
        }
        return _REVERSE_MAP;
    }

    /**
     * picks the best action based on the key combination
     *
     * @param {string} key - character for key
     * @param {Array} modifiers
     * @param {string=} action passed in
     */
    function _pickBestAction(key, modifiers, action) {

        // if no action was picked in we should try to pick the one
        // that we think would work best for this key
        if (!action) {
            action = _getReverseMap()[key] ? 'keydown' : 'keypress';
        }

        // modifier keys don't work as expected with keypress,
        // switch to keydown
        if (action == 'keypress' && modifiers.length) {
            action = 'keydown';
        }

        return action;
    }

    /**
     * binds a key sequence to an event
     *
     * @param {string} combo - combo specified in bind call
     * @param {Array} keys
     * @param {Function} callback
     * @param {string=} action
     * @returns void
     */
    function _bindSequence(combo, keys, callback, action) {

        // start off by adding a sequence level record for this combination
        // and setting the level to 0
        _sequenceLevels[combo] = 0;

        /**
         * callback to increase the sequence level for this sequence and reset
         * all other sequences that were active
         *
         * @param {string} nextAction
         * @returns {Function}
         */
        function _increaseSequence(nextAction) {
            return function() {
                _nextExpectedAction = nextAction;
                ++_sequenceLevels[combo];
                _resetSequenceTimer();
            };
        }

        /**
         * wraps the specified callback inside of another function in order
         * to reset all sequence counters as soon as this sequence is done
         *
         * @param {Event} e
         * @returns void
         */
        function _callbackAndReset(e) {
            _fireCallback(callback, e, combo);

            // we should ignore the next key up if the action is key down
            // or keypress.  this is so if you finish a sequence and
            // release the key the final key will not trigger a keyup
            if (action !== 'keyup') {
                _ignoreNextKeyup = _characterFromEvent(e);
            }

            // weird race condition if a sequence ends with the key
            // another sequence begins with
            setTimeout(_resetSequences, 10);
        }

        // loop through keys one at a time and bind the appropriate callback
        // function.  for any key leading up to the final one it should
        // increase the sequence. after the final, it should reset all sequences
        //
        // if an action is specified in the original bind call then that will
        // be used throughout.  otherwise we will pass the action that the
        // next key in the sequence should match.  this allows a sequence
        // to mix and match keypress and keydown events depending on which
        // ones are better suited to the key provided
        for (var i = 0; i < keys.length; ++i) {
            var isFinal = i + 1 === keys.length;
            var wrappedCallback = isFinal ? _callbackAndReset : _increaseSequence(action || _getKeyInfo(keys[i + 1]).action);
            _bindSingle(keys[i], wrappedCallback, action, combo, i);
        }
    }

    /**
     * Converts from a string key combination to an array
     *
     * @param  {string} combination like "command+shift+l"
     * @return {Array}
     */
    function _keysFromString(combination) {
        if (combination === '+') {
            return ['+'];
        }

        return combination.split('+');
    }

    /**
     * Gets info for a specific key combination
     *
     * @param  {string} combination key combination ("command+s" or "a" or "*")
     * @param  {string=} action
     * @returns {Object}
     */
    function _getKeyInfo(combination, action) {
        var keys,
            key,
            i,
            modifiers = [];

        // take the keys from this pattern and figure out what the actual
        // pattern is all about
        keys = _keysFromString(combination);

        for (i = 0; i < keys.length; ++i) {
            key = keys[i];

            // normalize key names
            if (_SPECIAL_ALIASES[key]) {
                key = _SPECIAL_ALIASES[key];
            }

            // if this is not a keypress event then we should
            // be smart about using shift keys
            // this will only work for US keyboards however
            if (action && action != 'keypress' && _SHIFT_MAP[key]) {
                key = _SHIFT_MAP[key];
                modifiers.push('shift');
            }

            // if this key is a modifier then add it to the list of modifiers
            if (_isModifier(key)) {
                modifiers.push(key);
            }
        }

        // depending on what the key combination is
        // we will try to pick the best event for it
        action = _pickBestAction(key, modifiers, action);

        return {
            key: key,
            modifiers: modifiers,
            action: action
        };
    }

    /**
     * binds a single keyboard combination
     *
     * @param {string} combination
     * @param {Function} callback
     * @param {string=} action
     * @param {string=} sequenceName - name of sequence if part of sequence
     * @param {number=} level - what part of the sequence the command is
     * @returns void
     */
    function _bindSingle(combination, callback, action, sequenceName, level) {

        // store a direct mapped reference for use with Mousetrap.trigger
        _directMap[combination + ':' + action] = callback;

        // make sure multiple spaces in a row become a single space
        combination = combination.replace(/\s+/g, ' ');

        var sequence = combination.split(' '),
            info;

        // if this pattern is a sequence of keys then run through this method
        // to reprocess each pattern one key at a time
        if (sequence.length > 1) {
            _bindSequence(combination, sequence, callback, action);
            return;
        }

        info = _getKeyInfo(combination, action);

        // make sure to initialize array if this is the first time
        // a callback is added for this key
        _callbacks[info.key] = _callbacks[info.key] || [];

        // remove an existing match if there is one
        _getMatches(info.key, info.modifiers, {type: info.action}, sequenceName, combination, level);

        // add this call back to the array
        // if it is a sequence put it at the beginning
        // if not put it at the end
        //
        // this is important because the way these are processed expects
        // the sequence ones to come first
        _callbacks[info.key][sequenceName ? 'unshift' : 'push']({
            callback: callback,
            modifiers: info.modifiers,
            action: info.action,
            seq: sequenceName,
            level: level,
            combo: combination
        });
    }

    /**
     * binds multiple combinations to the same callback
     *
     * @param {Array} combinations
     * @param {Function} callback
     * @param {string|undefined} action
     * @returns void
     */
    function _bindMultiple(combinations, callback, action) {
        for (var i = 0; i < combinations.length; ++i) {
            _bindSingle(combinations[i], callback, action);
        }
    }

    // start!
    _addEvent(document, 'keypress', _handleKeyEvent);
    _addEvent(document, 'keydown', _handleKeyEvent);
    _addEvent(document, 'keyup', _handleKeyEvent);

    var Mousetrap = {

        /**
         * binds an event to mousetrap
         *
         * can be a single key, a combination of keys separated with +,
         * an array of keys, or a sequence of keys separated by spaces
         *
         * be sure to list the modifier keys first to make sure that the
         * correct key ends up getting bound (the last key in the pattern)
         *
         * @param {string|Array} keys
         * @param {Function} callback
         * @param {string=} action - 'keypress', 'keydown', or 'keyup'
         * @returns void
         */
        bind: function(keys, callback, action) {
            keys = keys instanceof Array ? keys : [keys];
            _bindMultiple(keys, callback, action);
            return this;
        },

        /**
         * unbinds an event to mousetrap
         *
         * the unbinding sets the callback function of the specified key combo
         * to an empty function and deletes the corresponding key in the
         * _directMap dict.
         *
         * TODO: actually remove this from the _callbacks dictionary instead
         * of binding an empty function
         *
         * the keycombo+action has to be exactly the same as
         * it was defined in the bind method
         *
         * @param {string|Array} keys
         * @param {string} action
         * @returns void
         */
        unbind: function(keys, action) {
            return Mousetrap.bind(keys, function() {}, action);
        },

        /**
         * triggers an event that has already been bound
         *
         * @param {string} keys
         * @param {string=} action
         * @returns void
         */
        trigger: function(keys, action) {
            if (_directMap[keys + ':' + action]) {
                _directMap[keys + ':' + action]({}, keys);
            }
            return this;
        },

        /**
         * resets the library back to its initial state.  this is useful
         * if you want to clear out the current keyboard shortcuts and bind
         * new ones - for example if you switch to another page
         *
         * @returns void
         */
        reset: function() {
            _callbacks = {};
            _directMap = {};
            return this;
        },

       /**
        * should we stop this event before firing off callbacks
        *
        * @param {Event} e
        * @param {Element} element
        * @return {boolean}
        */
        stopCallback: function(e, element) {

            // if the element has the class "mousetrap" then no need to stop
            if ((' ' + element.className + ' ').indexOf(' mousetrap ') > -1) {
                return false;
            }

            // stop for input, select, and textarea
            return element.tagName == 'INPUT' || element.tagName == 'SELECT' || element.tagName == 'TEXTAREA' || element.isContentEditable;
        },

        /**
         * exposes _handleKey publicly so it can be overwritten by extensions
         */
        handleKey: _handleKey
    };

    // expose mousetrap to the global object
    window.Mousetrap = Mousetrap;

    // expose mousetrap as an AMD module
    if (typeof define === 'function' && define.amd) {
        define(Mousetrap);
    }
}) (window, document);

/*! angularjs-slider - v5.8.7 - 
 (c) Rafal Zajac <rzajac@gmail.com>, Valentin Hervieu <valentin@hervieu.me>, Jussi Saarivirta <jusasi@gmail.com>, Angelin Sirbu <angelin.sirbu@gmail.com> - 
 https://github.com/angular-slider/angularjs-slider - 
 2016-11-09 */
/*jslint unparam: true */
/*global angular: false, console: false, define, module */
(function(root, factory) {
  'use strict';
  /* istanbul ignore next */
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['angular'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    // to support bundler like browserify
    var angularObj = require('angular');
    if ((!angularObj || !angularObj.module) && typeof angular != 'undefined') {
      angularObj = angular;
    }
    module.exports = factory(angularObj);
  } else {
    // Browser globals (root is window)
    factory(root.angular);
  }

}(this, function(angular) {
  'use strict';
  var module = angular.module('rzModule', [])

  .factory('RzSliderOptions', function() {
    var defaultOptions = {
      floor: 0,
      ceil: null, //defaults to rz-slider-model
      step: 1,
      precision: 0,
      minRange: null,
      maxRange: null,
      pushRange: false,
      minLimit: null,
      maxLimit: null,
      id: null,
      translate: null,
      getLegend: null,
      stepsArray: null,
      bindIndexForStepsArray: false,
      draggableRange: false,
      draggableRangeOnly: false,
      showSelectionBar: false,
      showSelectionBarEnd: false,
      showSelectionBarFromValue: null,
      hidePointerLabels: false,
      hideLimitLabels: false,
      autoHideLimitLabels: true,
      readOnly: false,
      disabled: false,
      interval: 350,
      showTicks: false,
      showTicksValues: false,
      ticksArray: null,
      ticksTooltip: null,
      ticksValuesTooltip: null,
      vertical: false,
      getSelectionBarColor: null,
      getTickColor: null,
      getPointerColor: null,
      keyboardSupport: true,
      scale: 1,
      enforceStep: true,
      enforceRange: false,
      noSwitching: false,
      onlyBindHandles: false,
      onStart: null,
      onChange: null,
      onEnd: null,
      rightToLeft: false,
      boundPointerLabels: true,
      mergeRangeLabelsIfSame: false,
      customTemplateScope: null,
      logScale: false,
      customValueToPosition: null,
      customPositionToValue: null
    };
    var globalOptions = {};

    var factory = {};
    /**
     * `options({})` allows global configuration of all sliders in the
     * application.
     *
     *   var app = angular.module( 'App', ['rzModule'], function( RzSliderOptions ) {
     *     // show ticks for all sliders
     *     RzSliderOptions.options( { showTicks: true } );
     *   });
     */
    factory.options = function(value) {
      angular.extend(globalOptions, value);
    };

    factory.getOptions = function(options) {
      return angular.extend({}, defaultOptions, globalOptions, options);
    };

    return factory;
  })

  .factory('rzThrottle', ['$timeout', function($timeout) {
    /**
     * rzThrottle
     *
     * Taken from underscore project
     *
     * @param {Function} func
     * @param {number} wait
     * @param {ThrottleOptions} options
     * @returns {Function}
     */
    return function(func, wait, options) {
      'use strict';
      /* istanbul ignore next */
      var getTime = (Date.now || function() {
        return new Date().getTime();
      });
      var context, args, result;
      var timeout = null;
      var previous = 0;
      options = options || {};
      var later = function() {
        previous = getTime();
        timeout = null;
        result = func.apply(context, args);
        context = args = null;
      };
      return function() {
        var now = getTime();
        var remaining = wait - (now - previous);
        context = this;
        args = arguments;
        if (remaining <= 0) {
          $timeout.cancel(timeout);
          timeout = null;
          previous = now;
          result = func.apply(context, args);
          context = args = null;
        } else if (!timeout && options.trailing !== false) {
          timeout = $timeout(later, remaining);
        }
        return result;
      };
    }
  }])

  .factory('RzSlider', ['$timeout', '$document', '$window', '$compile', 'RzSliderOptions', 'rzThrottle', function($timeout, $document, $window, $compile, RzSliderOptions, rzThrottle) {
    'use strict';

    /**
     * Slider
     *
     * @param {ngScope} scope            The AngularJS scope
     * @param {Element} sliderElem The slider directive element wrapped in jqLite
     * @constructor
     */
    var Slider = function(scope, sliderElem) {
      /**
       * The slider's scope
       *
       * @type {ngScope}
       */
      this.scope = scope;

      /**
       * The slider inner low value (linked to rzSliderModel)
       * @type {number}
       */
      this.lowValue = 0;

      /**
       * The slider inner high value (linked to rzSliderHigh)
       * @type {number}
       */
      this.highValue = 0;

      /**
       * Slider element wrapped in jqLite
       *
       * @type {jqLite}
       */
      this.sliderElem = sliderElem;

      /**
       * Slider type
       *
       * @type {boolean} Set to true for range slider
       */
      this.range = this.scope.rzSliderModel !== undefined && this.scope.rzSliderHigh !== undefined;

      /**
       * Values recorded when first dragging the bar
       *
       * @type {Object}
       */
      this.dragging = {
        active: false,
        value: 0,
        difference: 0,
        position: 0,
        lowLimit: 0,
        highLimit: 0
      };

      /**
       * property that handle position (defaults to left for horizontal)
       * @type {string}
       */
      this.positionProperty = 'left';

      /**
       * property that handle dimension (defaults to width for horizontal)
       * @type {string}
       */
      this.dimensionProperty = 'width';

      /**
       * Half of the width or height of the slider handles
       *
       * @type {number}
       */
      this.handleHalfDim = 0;

      /**
       * Maximum position the slider handle can have
       *
       * @type {number}
       */
      this.maxPos = 0;

      /**
       * Precision
       *
       * @type {number}
       */
      this.precision = 0;

      /**
       * Step
       *
       * @type {number}
       */
      this.step = 1;

      /**
       * The name of the handle we are currently tracking
       *
       * @type {string}
       */
      this.tracking = '';

      /**
       * Minimum value (floor) of the model
       *
       * @type {number}
       */
      this.minValue = 0;

      /**
       * Maximum value (ceiling) of the model
       *
       * @type {number}
       */
      this.maxValue = 0;


      /**
       * The delta between min and max value
       *
       * @type {number}
       */
      this.valueRange = 0;


      /**
       * If showTicks/showTicksValues options are number.
       * In this case, ticks values should be displayed below the slider.
       * @type {boolean}
       */
      this.intermediateTicks = false;

      /**
       * Set to true if init method already executed
       *
       * @type {boolean}
       */
      this.initHasRun = false;

      /**
       * Used to call onStart on the first keydown event
       *
       * @type {boolean}
       */
      this.firstKeyDown = false;

      /**
       * Internal flag to prevent watchers to be called when the sliders value are modified internally.
       * @type {boolean}
       */
      this.internalChange = false;

      /**
       * Internal flag to keep track of the visibility of combo label
       * @type {boolean}
       */
      this.cmbLabelShown = false;

      /**
       * Internal variable to keep track of the focus element
       */
      this.currentFocusElement = null;

      // Slider DOM elements wrapped in jqLite
      this.fullBar = null; // The whole slider bar
      this.selBar = null; // Highlight between two handles
      this.minH = null; // Left slider handle
      this.maxH = null; // Right slider handle
      this.flrLab = null; // Floor label
      this.ceilLab = null; // Ceiling label
      this.minLab = null; // Label above the low value
      this.maxLab = null; // Label above the high value
      this.cmbLab = null; // Combined label
      this.ticks = null; // The ticks

      // Initialize slider
      this.init();
    };

    // Add instance methods
    Slider.prototype = {

      /**
       * Initialize slider
       *
       * @returns {undefined}
       */
      init: function() {
        var thrLow, thrHigh,
          self = this;

        var calcDimFn = function() {
          self.calcViewDimensions();
        };

        this.applyOptions();
        this.syncLowValue();
        if (this.range)
          this.syncHighValue();
        this.initElemHandles();
        this.manageElementsStyle();
        this.setDisabledState();
        this.calcViewDimensions();
        this.setMinAndMax();
        this.addAccessibility();
        this.updateCeilLab();
        this.updateFloorLab();
        this.initHandles();
        this.manageEventsBindings();

        // Recalculate slider view dimensions
        this.scope.$on('reCalcViewDimensions', calcDimFn);

        // Recalculate stuff if view port dimensions have changed
        angular.element($window).on('resize', calcDimFn);

        this.initHasRun = true;

        // Watch for changes to the model
        thrLow = rzThrottle(function() {
          self.onLowHandleChange();
        }, self.options.interval);

        thrHigh = rzThrottle(function() {
          self.onHighHandleChange();
        }, self.options.interval);

        this.scope.$on('rzSliderForceRender', function() {
          self.resetLabelsValue();
          thrLow();
          if (self.range) {
            thrHigh();
          }
          self.resetSlider();
        });

        // Watchers (order is important because in case of simultaneous change,
        // watchers will be called in the same order)
        this.scope.$watch('rzSliderOptions()', function(newValue, oldValue) {
          if (newValue === oldValue)
            return;
          self.applyOptions(); // need to be called before synchronizing the values
          self.syncLowValue();
          if (self.range)
            self.syncHighValue();
          self.resetSlider();
        }, true);

        this.scope.$watch('rzSliderModel', function(newValue, oldValue) {
          if (self.internalChange)
            return;
          if (newValue === oldValue)
            return;
          thrLow();
        });

        this.scope.$watch('rzSliderHigh', function(newValue, oldValue) {
          if (self.internalChange)
            return;
          if (newValue === oldValue)
            return;
          if (newValue != null)
            thrHigh();
          if (self.range && newValue == null || !self.range && newValue != null) {
            self.applyOptions();
            self.resetSlider();
          }
        });

        this.scope.$on('$destroy', function() {
          self.unbindEvents();
          angular.element($window).off('resize', calcDimFn);
          self.currentFocusElement = null;
        });
      },

      findStepIndex: function(modelValue) {
        var index = 0;
        for (var i = 0; i < this.options.stepsArray.length; i++) {
          var step = this.options.stepsArray[i];
          if (step === modelValue) {
            index = i;
            break;
          }
          else if (angular.isDate(step)) {
            if (step.getTime() === modelValue.getTime()) {
              index = i;
              break;
            }
          }
          else if (angular.isObject(step)) {
            if (angular.isDate(step.value) && step.value.getTime() === modelValue.getTime() || step.value === modelValue) {
              index = i;
              break;
            }
          }
        }
        return index;
      },

      syncLowValue: function() {
        if (this.options.stepsArray) {
          if (!this.options.bindIndexForStepsArray)
            this.lowValue = this.findStepIndex(this.scope.rzSliderModel);
          else
            this.lowValue = this.scope.rzSliderModel
        }
        else
          this.lowValue = this.scope.rzSliderModel;
      },

      syncHighValue: function() {
        if (this.options.stepsArray) {
          if (!this.options.bindIndexForStepsArray)
            this.highValue = this.findStepIndex(this.scope.rzSliderHigh);
          else
            this.highValue = this.scope.rzSliderHigh
        }
        else
          this.highValue = this.scope.rzSliderHigh;
      },

      getStepValue: function(sliderValue) {
        var step = this.options.stepsArray[sliderValue];
        if (angular.isDate(step))
          return step;
        if (angular.isObject(step))
          return step.value;
        return step;
      },

      applyLowValue: function() {
        if (this.options.stepsArray) {
          if (!this.options.bindIndexForStepsArray)
            this.scope.rzSliderModel = this.getStepValue(this.lowValue);
          else
            this.scope.rzSliderModel = this.lowValue
        }
        else
          this.scope.rzSliderModel = this.lowValue;
      },

      applyHighValue: function() {
        if (this.options.stepsArray) {
          if (!this.options.bindIndexForStepsArray)
            this.scope.rzSliderHigh = this.getStepValue(this.highValue);
          else
            this.scope.rzSliderHigh = this.highValue
        }
        else
          this.scope.rzSliderHigh = this.highValue;
      },

      /*
       * Reflow the slider when the low handle changes (called with throttle)
       */
      onLowHandleChange: function() {
        this.syncLowValue();
        if (this.range)
          this.syncHighValue();
        this.setMinAndMax();
        this.updateLowHandle(this.valueToPosition(this.lowValue));
        this.updateSelectionBar();
        this.updateTicksScale();
        this.updateAriaAttributes();
        if (this.range) {
          this.updateCmbLabel();
        }
      },

      /*
       * Reflow the slider when the high handle changes (called with throttle)
       */
      onHighHandleChange: function() {
        this.syncLowValue();
        this.syncHighValue();
        this.setMinAndMax();
        this.updateHighHandle(this.valueToPosition(this.highValue));
        this.updateSelectionBar();
        this.updateTicksScale();
        this.updateCmbLabel();
        this.updateAriaAttributes();
      },

      /**
       * Read the user options and apply them to the slider model
       */
      applyOptions: function() {
        var sliderOptions;
        if (this.scope.rzSliderOptions)
          sliderOptions = this.scope.rzSliderOptions();
        else
          sliderOptions = {};

        this.options = RzSliderOptions.getOptions(sliderOptions);

        if (this.options.step <= 0)
          this.options.step = 1;

        this.range = this.scope.rzSliderModel !== undefined && this.scope.rzSliderHigh !== undefined;
        this.options.draggableRange = this.range && this.options.draggableRange;
        this.options.draggableRangeOnly = this.range && this.options.draggableRangeOnly;
        if (this.options.draggableRangeOnly) {
          this.options.draggableRange = true;
        }

        this.options.showTicks = this.options.showTicks || this.options.showTicksValues || !!this.options.ticksArray;
        this.scope.showTicks = this.options.showTicks; //scope is used in the template
        if (angular.isNumber(this.options.showTicks) || this.options.ticksArray)
          this.intermediateTicks = true;

        this.options.showSelectionBar = this.options.showSelectionBar || this.options.showSelectionBarEnd
          || this.options.showSelectionBarFromValue !== null;

        if (this.options.stepsArray) {
          this.parseStepsArray();
        } else {
          if (this.options.translate)
            this.customTrFn = this.options.translate;
          else
            this.customTrFn = function(value) {
              return String(value);
            };

          this.getLegend = this.options.getLegend;
        }

        if (this.options.vertical) {
          this.positionProperty = 'bottom';
          this.dimensionProperty = 'height';
        }

        if (this.options.customTemplateScope)
          this.scope.custom = this.options.customTemplateScope;
      },

      parseStepsArray: function() {
        this.options.floor = 0;
        this.options.ceil = this.options.stepsArray.length - 1;
        this.options.step = 1;

        if (this.options.translate) {
          this.customTrFn = this.options.translate;
        }
        else {
          this.customTrFn = function(modelValue) {
            if (this.options.bindIndexForStepsArray)
              return this.getStepValue(modelValue);
            return modelValue;
          };
        }

        this.getLegend = function(index) {
          var step = this.options.stepsArray[index];
          if (angular.isObject(step))
            return step.legend;
          return null;
        };
      },

      /**
       * Resets slider
       *
       * @returns {undefined}
       */
      resetSlider: function() {
        this.manageElementsStyle();
        this.addAccessibility();
        this.setMinAndMax();
        this.updateCeilLab();
        this.updateFloorLab();
        this.unbindEvents();
        this.manageEventsBindings();
        this.setDisabledState();
        this.calcViewDimensions();
        this.refocusPointerIfNeeded();
      },

      refocusPointerIfNeeded: function() {
        if (this.currentFocusElement) {
          this.onPointerFocus(this.currentFocusElement.pointer, this.currentFocusElement.ref);
          this.focusElement(this.currentFocusElement.pointer)
        }
      },

      /**
       * Set the slider children to variables for easy access
       *
       * Run only once during initialization
       *
       * @returns {undefined}
       */
      initElemHandles: function() {
        // Assign all slider elements to object properties for easy access
        angular.forEach(this.sliderElem.children(), function(elem, index) {
          var jElem = angular.element(elem);

          switch (index) {
            case 0:
              this.fullBar = jElem;
              break;
            case 1:
              this.selBar = jElem;
              break;
            case 2:
              this.minH = jElem;
              break;
            case 3:
              this.maxH = jElem;
              break;
            case 4:
              this.flrLab = jElem;
              break;
            case 5:
              this.ceilLab = jElem;
              break;
            case 6:
              this.minLab = jElem;
              break;
            case 7:
              this.maxLab = jElem;
              break;
            case 8:
              this.cmbLab = jElem;
              break;
            case 9:
              this.ticks = jElem;
              break;
          }

        }, this);

        // Initialize position cache properties
        this.selBar.rzsp = 0;
        this.minH.rzsp = 0;
        this.maxH.rzsp = 0;
        this.flrLab.rzsp = 0;
        this.ceilLab.rzsp = 0;
        this.minLab.rzsp = 0;
        this.maxLab.rzsp = 0;
        this.cmbLab.rzsp = 0;
      },

      /**
       * Update each elements style based on options
       */
      manageElementsStyle: function() {

        if (!this.range)
          this.maxH.css('display', 'none');
        else
          this.maxH.css('display', '');


        this.alwaysHide(this.flrLab, this.options.showTicksValues || this.options.hideLimitLabels);
        this.alwaysHide(this.ceilLab, this.options.showTicksValues || this.options.hideLimitLabels);

        var hideLabelsForTicks = this.options.showTicksValues && !this.intermediateTicks;
        this.alwaysHide(this.minLab, hideLabelsForTicks || this.options.hidePointerLabels);
        this.alwaysHide(this.maxLab, hideLabelsForTicks || !this.range || this.options.hidePointerLabels);
        this.alwaysHide(this.cmbLab, hideLabelsForTicks || !this.range || this.options.hidePointerLabels);
        this.alwaysHide(this.selBar, !this.range && !this.options.showSelectionBar);

        if (this.options.vertical)
          this.sliderElem.addClass('rz-vertical');

        if (this.options.draggableRange)
          this.selBar.addClass('rz-draggable');
        else
          this.selBar.removeClass('rz-draggable');

        if (this.intermediateTicks && this.options.showTicksValues)
          this.ticks.addClass('rz-ticks-values-under');
      },

      alwaysHide: function(el, hide) {
        el.rzAlwaysHide = hide;
        if (hide)
          this.hideEl(el);
        else
          this.showEl(el)
      },

      /**
       * Manage the events bindings based on readOnly and disabled options
       *
       * @returns {undefined}
       */
      manageEventsBindings: function() {
        if (this.options.disabled || this.options.readOnly)
          this.unbindEvents();
        else
          this.bindEvents();
      },

      /**
       * Set the disabled state based on rzSliderDisabled
       *
       * @returns {undefined}
       */
      setDisabledState: function() {
        if (this.options.disabled) {
          this.sliderElem.attr('disabled', 'disabled');
        } else {
          this.sliderElem.attr('disabled', null);
        }
      },

      /**
       * Reset label values
       *
       * @return {undefined}
       */
      resetLabelsValue: function() {
        this.minLab.rzsv = undefined;
        this.maxLab.rzsv = undefined;
      },

      /**
       * Initialize slider handles positions and labels
       *
       * Run only once during initialization and every time view port changes size
       *
       * @returns {undefined}
       */
      initHandles: function() {
        this.updateLowHandle(this.valueToPosition(this.lowValue));

        /*
         the order here is important since the selection bar should be
         updated after the high handle but before the combined label
         */
        if (this.range)
          this.updateHighHandle(this.valueToPosition(this.highValue));
        this.updateSelectionBar();
        if (this.range)
          this.updateCmbLabel();

        this.updateTicksScale();
      },

      /**
       * Translate value to human readable format
       *
       * @param {number|string} value
       * @param {jqLite} label
       * @param {String} which
       * @param {boolean} [useCustomTr]
       * @returns {undefined}
       */
      translateFn: function(value, label, which, useCustomTr) {
        useCustomTr = useCustomTr === undefined ? true : useCustomTr;

        var valStr = '',
          getDimension = false,
          noLabelInjection = label.hasClass('no-label-injection');

        if (useCustomTr) {
          if (this.options.stepsArray && !this.options.bindIndexForStepsArray)
            value = this.getStepValue(value);
          valStr = String(this.customTrFn(value, this.options.id, which));
        }
        else {
          valStr = String(value)
        }

        if (label.rzsv === undefined || label.rzsv.length !== valStr.length || (label.rzsv.length > 0 && label.rzsd === 0)) {
          getDimension = true;
          label.rzsv = valStr;
        }

        if (!noLabelInjection) {
          label.html(valStr);
        }
        ;

        this.scope[which + 'Label'] = valStr;

        // Update width only when length of the label have changed
        if (getDimension) {
          this.getDimension(label);
        }
      },

      /**
       * Set maximum and minimum values for the slider and ensure the model and high
       * value match these limits
       * @returns {undefined}
       */
      setMinAndMax: function() {

        this.step = +this.options.step;
        this.precision = +this.options.precision;

        this.minValue = this.options.floor;
        if (this.options.logScale && this.minValue === 0)
          throw Error("Can't use floor=0 with logarithmic scale");

        if (this.options.enforceStep) {
          this.lowValue = this.roundStep(this.lowValue);
          if (this.range)
            this.highValue = this.roundStep(this.highValue);
        }

        if (this.options.ceil != null)
          this.maxValue = this.options.ceil;
        else
          this.maxValue = this.options.ceil = this.range ? this.highValue : this.lowValue;

        if (this.options.enforceRange) {
          this.lowValue = this.sanitizeValue(this.lowValue);
          if (this.range)
            this.highValue = this.sanitizeValue(this.highValue);
        }

        this.applyLowValue();
        if (this.range)
          this.applyHighValue();

        this.valueRange = this.maxValue - this.minValue;
      },

      /**
       * Adds accessibility attributes
       *
       * Run only once during initialization
       *
       * @returns {undefined}
       */
      addAccessibility: function() {
        this.minH.attr('role', 'slider');
        this.updateAriaAttributes();
        if (this.options.keyboardSupport && !(this.options.readOnly || this.options.disabled))
          this.minH.attr('tabindex', '0');
        else
          this.minH.attr('tabindex', '');
        if (this.options.vertical)
          this.minH.attr('aria-orientation', 'vertical');

        if (this.range) {
          this.maxH.attr('role', 'slider');
          if (this.options.keyboardSupport && !(this.options.readOnly || this.options.disabled))
            this.maxH.attr('tabindex', '0');
          else
            this.maxH.attr('tabindex', '');
          if (this.options.vertical)
            this.maxH.attr('aria-orientation', 'vertical');
        }
      },

      /**
       * Updates aria attributes according to current values
       */
      updateAriaAttributes: function() {
        this.minH.attr({
          'aria-valuenow': this.scope.rzSliderModel,
          'aria-valuetext': this.customTrFn(this.scope.rzSliderModel, this.options.id, 'model'),
          'aria-valuemin': this.minValue,
          'aria-valuemax': this.maxValue
        });
        if (this.range) {
          this.maxH.attr({
            'aria-valuenow': this.scope.rzSliderHigh,
            'aria-valuetext': this.customTrFn(this.scope.rzSliderHigh, this.options.id, 'high'),
            'aria-valuemin': this.minValue,
            'aria-valuemax': this.maxValue
          });
        }
      },

      /**
       * Calculate dimensions that are dependent on view port size
       *
       * Run once during initialization and every time view port changes size.
       *
       * @returns {undefined}
       */
      calcViewDimensions: function() {
        var handleWidth = this.getDimension(this.minH);

        this.handleHalfDim = handleWidth / 2;
        this.barDimension = this.getDimension(this.fullBar);

        this.maxPos = this.barDimension - handleWidth;

        this.getDimension(this.sliderElem);
        this.sliderElem.rzsp = this.sliderElem[0].getBoundingClientRect()[this.positionProperty];

        if (this.initHasRun) {
          this.updateFloorLab();
          this.updateCeilLab();
          this.initHandles();
          var self = this;
          $timeout(function() {
            self.updateTicksScale();
          });
        }
      },

      /**
       * Update the ticks position
       *
       * @returns {undefined}
       */
      updateTicksScale: function() {
        if (!this.options.showTicks) return;

        var ticksArray = this.options.ticksArray || this.getTicksArray(),
          translate = this.options.vertical ? 'translateY' : 'translateX',
          self = this;

        if (this.options.rightToLeft)
          ticksArray.reverse();

        this.scope.ticks = ticksArray.map(function(value) {
          var position = self.valueToPosition(value);

          if (self.options.vertical)
            position = self.maxPos - position;

          var tick = {
            selected: self.isTickSelected(value),
            style: {
              transform: translate + '(' + Math.round(position) + 'px)'
            }
          };
          if (tick.selected && self.options.getSelectionBarColor) {
            tick.style['background-color'] = self.getSelectionBarColor();
          }
          if (!tick.selected && self.options.getTickColor) {
            tick.style['background-color'] = self.getTickColor(value);
          }
          if (self.options.ticksTooltip) {
            tick.tooltip = self.options.ticksTooltip(value);
            tick.tooltipPlacement = self.options.vertical ? 'right' : 'top';
          }
          if (self.options.showTicksValues) {
            tick.value = self.getDisplayValue(value, 'tick-value');
            if (self.options.ticksValuesTooltip) {
              tick.valueTooltip = self.options.ticksValuesTooltip(value);
              tick.valueTooltipPlacement = self.options.vertical ? 'right' : 'top';
            }
          }
          if (self.getLegend) {
            var legend = self.getLegend(value, self.options.id);
            if (legend)
              tick.legend = legend;
          }
          return tick;
        });
      },

      getTicksArray: function() {
        var step = this.step,
          ticksArray = [];
        if (this.intermediateTicks)
          step = this.options.showTicks;
        for (var value = this.minValue; value <= this.maxValue; value += step) {
          ticksArray.push(value);
        }
        return ticksArray;
      },

      isTickSelected: function(value) {
        if (!this.range) {
          if (this.options.showSelectionBarFromValue !== null) {
            var center = this.options.showSelectionBarFromValue;
            if (this.lowValue > center && value >= center && value <= this.lowValue)
              return true;
            else if (this.lowValue < center && value <= center && value >= this.lowValue)
              return true;
          }
          else if (this.options.showSelectionBarEnd) {
            if (value >= this.lowValue)
              return true;
          }
          else if (this.options.showSelectionBar && value <= this.lowValue)
            return true;
        }
        if (this.range && value >= this.lowValue && value <= this.highValue)
          return true;
        return false;
      },

      /**
       * Update position of the floor label
       *
       * @returns {undefined}
       */
      updateFloorLab: function() {
        this.translateFn(this.minValue, this.flrLab, 'floor');
        this.getDimension(this.flrLab);
        var position = this.options.rightToLeft ? this.barDimension - this.flrLab.rzsd : 0;
        this.setPosition(this.flrLab, position);
      },

      /**
       * Update position of the ceiling label
       *
       * @returns {undefined}
       */
      updateCeilLab: function() {
        this.translateFn(this.maxValue, this.ceilLab, 'ceil');
        this.getDimension(this.ceilLab);
        var position = this.options.rightToLeft ? 0 : this.barDimension - this.ceilLab.rzsd;
        this.setPosition(this.ceilLab, position);
      },

      /**
       * Update slider handles and label positions
       *
       * @param {string} which
       * @param {number} newPos
       */
      updateHandles: function(which, newPos) {
        if (which === 'lowValue')
          this.updateLowHandle(newPos);
        else
          this.updateHighHandle(newPos);

        this.updateSelectionBar();
        this.updateTicksScale();
        if (this.range)
          this.updateCmbLabel();
      },

      /**
       * Helper function to work out the position for handle labels depending on RTL or not
       *
       * @param {string} labelName maxLab or minLab
       * @param newPos
       *
       * @returns {number}
       */
      getHandleLabelPos: function(labelName, newPos) {
        var labelRzsd = this[labelName].rzsd,
          nearHandlePos = newPos - labelRzsd / 2 + this.handleHalfDim,
          endOfBarPos = this.barDimension - labelRzsd;

        if (!this.options.boundPointerLabels)
          return nearHandlePos;

        if (this.options.rightToLeft && labelName === 'minLab' || !this.options.rightToLeft && labelName === 'maxLab') {
          return Math.min(nearHandlePos, endOfBarPos);
        } else {
          return Math.min(Math.max(nearHandlePos, 0), endOfBarPos);
        }
      },

      /**
       * Update low slider handle position and label
       *
       * @param {number} newPos
       * @returns {undefined}
       */
      updateLowHandle: function(newPos) {
        this.setPosition(this.minH, newPos);
        this.translateFn(this.lowValue, this.minLab, 'model');
        this.setPosition(this.minLab, this.getHandleLabelPos('minLab', newPos));

        if (this.options.getPointerColor) {
          var pointercolor = this.getPointerColor('min');
          this.scope.minPointerStyle = {
            backgroundColor: pointercolor
          };
        }

        if (this.options.autoHideLimitLabels) {
          this.shFloorCeil();
        }
      },

      /**
       * Update high slider handle position and label
       *
       * @param {number} newPos
       * @returns {undefined}
       */
      updateHighHandle: function(newPos) {
        this.setPosition(this.maxH, newPos);
        this.translateFn(this.highValue, this.maxLab, 'high');
        this.setPosition(this.maxLab, this.getHandleLabelPos('maxLab', newPos));

        if (this.options.getPointerColor) {
          var pointercolor = this.getPointerColor('max');
          this.scope.maxPointerStyle = {
            backgroundColor: pointercolor
          };
        }
        if (this.options.autoHideLimitLabels) {
          this.shFloorCeil();
        }

      },

      /**
       * Show/hide floor/ceiling label
       *
       * @returns {undefined}
       */
      shFloorCeil: function() {
        // Show based only on hideLimitLabels if pointer labels are hidden
        if (this.options.hidePointerLabels) {
          return;
        }
        var flHidden = false,
          clHidden = false,
          isMinLabAtFloor = this.isLabelBelowFloorLab(this.minLab),
          isMinLabAtCeil = this.isLabelAboveCeilLab(this.minLab),
          isMaxLabAtCeil = this.isLabelAboveCeilLab(this.maxLab),
          isCmbLabAtFloor = this.isLabelBelowFloorLab(this.cmbLab),
          isCmbLabAtCeil =  this.isLabelAboveCeilLab(this.cmbLab);

        if (isMinLabAtFloor) {
          flHidden = true;
          this.hideEl(this.flrLab);
        } else {
          flHidden = false;
          this.showEl(this.flrLab);
        }

        if (isMinLabAtCeil) {
          clHidden = true;
          this.hideEl(this.ceilLab);
        } else {
          clHidden = false;
          this.showEl(this.ceilLab);
        }

        if (this.range) {
          var hideCeil = this.cmbLabelShown ? isCmbLabAtCeil : isMaxLabAtCeil;
          var hideFloor = this.cmbLabelShown ? isCmbLabAtFloor : isMinLabAtFloor;

          if (hideCeil) {
            this.hideEl(this.ceilLab);
          } else if (!clHidden) {
            this.showEl(this.ceilLab);
          }

          // Hide or show floor label
          if (hideFloor) {
            this.hideEl(this.flrLab);
          } else if (!flHidden) {
            this.showEl(this.flrLab);
          }
        }
      },

      isLabelBelowFloorLab: function(label) {
        var isRTL = this.options.rightToLeft,
          pos = label.rzsp,
          dim = label.rzsd,
          floorPos = this.flrLab.rzsp,
          floorDim = this.flrLab.rzsd;
        return isRTL ?
        pos + dim >= floorPos - 2 :
        pos <= floorPos + floorDim + 2;
      },

      isLabelAboveCeilLab: function(label) {
        var isRTL = this.options.rightToLeft,
          pos = label.rzsp,
          dim = label.rzsd,
          ceilPos = this.ceilLab.rzsp,
          ceilDim = this.ceilLab.rzsd;
        return isRTL ?
        pos <= ceilPos + ceilDim + 2 :
        pos + dim >= ceilPos - 2;
      },

      /**
       * Update slider selection bar, combined label and range label
       *
       * @returns {undefined}
       */
      updateSelectionBar: function() {
        var position = 0,
          dimension = 0,
          isSelectionBarFromRight = this.options.rightToLeft ? !this.options.showSelectionBarEnd : this.options.showSelectionBarEnd,
          positionForRange = this.options.rightToLeft ? this.maxH.rzsp + this.handleHalfDim : this.minH.rzsp + this.handleHalfDim;

        if (this.range) {
          dimension = Math.abs(this.maxH.rzsp - this.minH.rzsp);
          position = positionForRange;
        }
        else {
          if (this.options.showSelectionBarFromValue !== null) {
            var center = this.options.showSelectionBarFromValue,
              centerPosition = this.valueToPosition(center),
              isModelGreaterThanCenter = this.options.rightToLeft ? this.lowValue <= center : this.lowValue > center;
            if (isModelGreaterThanCenter) {
              dimension = this.minH.rzsp - centerPosition;
              position = centerPosition + this.handleHalfDim;
            }
            else {
              dimension = centerPosition - this.minH.rzsp;
              position = this.minH.rzsp + this.handleHalfDim;
            }
          }
          else if (isSelectionBarFromRight) {
            dimension = Math.abs(this.maxPos - this.minH.rzsp) + this.handleHalfDim;
            position = this.minH.rzsp + this.handleHalfDim;
          } else {
            dimension = Math.abs(this.maxH.rzsp - this.minH.rzsp) + this.handleHalfDim;
            position = 0;
          }
        }
        this.setDimension(this.selBar, dimension);
        this.setPosition(this.selBar, position);
        if (this.options.getSelectionBarColor) {
          var color = this.getSelectionBarColor();
          this.scope.barStyle = {
            backgroundColor: color
          };
        }
      },

      /**
       * Wrapper around the getSelectionBarColor of the user to pass to
       * correct parameters
       */
      getSelectionBarColor: function() {
        if (this.range)
          return this.options.getSelectionBarColor(this.scope.rzSliderModel, this.scope.rzSliderHigh);
        return this.options.getSelectionBarColor(this.scope.rzSliderModel);
      },

      /**
       * Wrapper around the getPointerColor of the user to pass to
       * correct parameters
       */
      getPointerColor: function(pointerType) {
        if (pointerType === 'max') {
          return this.options.getPointerColor(this.scope.rzSliderHigh, pointerType);
        }
        return this.options.getPointerColor(this.scope.rzSliderModel, pointerType);
      },

      /**
       * Wrapper around the getTickColor of the user to pass to
       * correct parameters
       */
      getTickColor: function(value) {
        return this.options.getTickColor(value);
      },

      /**
       * Update combined label position and value
       *
       * @returns {undefined}
       */
      updateCmbLabel: function() {
        var isLabelOverlap = null;
        if (this.options.rightToLeft) {
          isLabelOverlap = this.minLab.rzsp - this.minLab.rzsd - 10 <= this.maxLab.rzsp;
        } else {
          isLabelOverlap = this.minLab.rzsp + this.minLab.rzsd + 10 >= this.maxLab.rzsp;
        }

        if (isLabelOverlap) {
          var lowTr = this.getDisplayValue(this.lowValue, 'model'),
            highTr = this.getDisplayValue(this.highValue, 'high'),
            labelVal = '';
          if (this.options.mergeRangeLabelsIfSame && lowTr === highTr) {
            labelVal = lowTr;
          } else {
            labelVal = this.options.rightToLeft ? highTr + ' - ' + lowTr : lowTr + ' - ' + highTr;
          }

          this.translateFn(labelVal, this.cmbLab, 'cmb', false);
          var pos = this.options.boundPointerLabels ? Math.min(
            Math.max(
              this.selBar.rzsp + this.selBar.rzsd / 2 - this.cmbLab.rzsd / 2,
              0
            ),
            this.barDimension - this.cmbLab.rzsd
          ) : this.selBar.rzsp + this.selBar.rzsd / 2 - this.cmbLab.rzsd / 2;

          this.setPosition(this.cmbLab, pos);
          this.cmbLabelShown = true;
          this.hideEl(this.minLab);
          this.hideEl(this.maxLab);
          this.showEl(this.cmbLab);
        } else {
          this.cmbLabelShown = false;
          this.showEl(this.maxLab);
          this.showEl(this.minLab);
          this.hideEl(this.cmbLab);
        }
        if (this.options.autoHideLimitLabels) {
          this.shFloorCeil();
        }
      },

      /**
       * Return the translated value if a translate function is provided else the original value
       * @param value
       * @param which if it's min or max handle
       * @returns {*}
       */
      getDisplayValue: function(value, which) {
        if (this.options.stepsArray && !this.options.bindIndexForStepsArray) {
          value = this.getStepValue(value);
        }
        return this.customTrFn(value, this.options.id, which);
      },

      /**
       * Round value to step and precision based on minValue
       *
       * @param {number} value
       * @param {number} customStep a custom step to override the defined step
       * @returns {number}
       */
      roundStep: function(value, customStep) {
        var step = customStep ? customStep : this.step,
          steppedDifference = parseFloat((value - this.minValue) / step).toPrecision(12);
        steppedDifference = Math.round(+steppedDifference) * step;
        var newValue = (this.minValue + steppedDifference).toFixed(this.precision);
        return +newValue;
      },

      /**
       * Hide element
       *
       * @param element
       * @returns {jqLite} The jqLite wrapped DOM element
       */
      hideEl: function(element) {
        return element.css({
          visibility: 'hidden'
        });
      },

      /**
       * Show element
       *
       * @param element The jqLite wrapped DOM element
       * @returns {jqLite} The jqLite
       */
      showEl: function(element) {
        if (!!element.rzAlwaysHide) {
          return element;
        }

        return element.css({
          visibility: 'visible'
        });
      },

      /**
       * Set element left/top position depending on whether slider is horizontal or vertical
       *
       * @param {jqLite} elem The jqLite wrapped DOM element
       * @param {number} pos
       * @returns {number}
       */
      setPosition: function(elem, pos) {
        elem.rzsp = pos;
        var css = {};
        css[this.positionProperty] = Math.round(pos) + 'px';
        elem.css(css);
        return pos;
      },

      /**
       * Get element width/height depending on whether slider is horizontal or vertical
       *
       * @param {jqLite} elem The jqLite wrapped DOM element
       * @returns {number}
       */
      getDimension: function(elem) {
        var val = elem[0].getBoundingClientRect();
        if (this.options.vertical)
          elem.rzsd = (val.bottom - val.top) * this.options.scale;
        else
          elem.rzsd = (val.right - val.left) * this.options.scale;
        return elem.rzsd;
      },

      /**
       * Set element width/height depending on whether slider is horizontal or vertical
       *
       * @param {jqLite} elem  The jqLite wrapped DOM element
       * @param {number} dim
       * @returns {number}
       */
      setDimension: function(elem, dim) {
        elem.rzsd = dim;
        var css = {};
        css[this.dimensionProperty] = Math.round(dim) + 'px';
        elem.css(css);
        return dim;
      },

      /**
       * Returns a value that is within slider range
       *
       * @param {number} val
       * @returns {number}
       */
      sanitizeValue: function(val) {
        return Math.min(Math.max(val, this.minValue), this.maxValue);
      },

      /**
       * Translate value to pixel position
       *
       * @param {number} val
       * @returns {number}
       */
      valueToPosition: function(val) {
        var fn = this.linearValueToPosition;
        if (this.options.customValueToPosition)
          fn = this.options.customValueToPosition;
        else if (this.options.logScale)
          fn = this.logValueToPosition;

        val = this.sanitizeValue(val);
        var percent = fn(val, this.minValue, this.maxValue) || 0;
        if (this.options.rightToLeft)
          percent = 1 - percent;
        return percent * this.maxPos;
      },

      linearValueToPosition: function(val, minVal, maxVal) {
        var range = maxVal - minVal;
        return (val - minVal) / range;
      },

      logValueToPosition: function(val, minVal, maxVal) {
        val = Math.log(val);
        minVal = Math.log(minVal);
        maxVal = Math.log(maxVal);
        var range = maxVal - minVal;
        return (val - minVal) / range;
      },

      /**
       * Translate position to model value
       *
       * @param {number} position
       * @returns {number}
       */
      positionToValue: function(position) {
        var percent = position / this.maxPos;
        if (this.options.rightToLeft)
          percent = 1 - percent;
        var fn = this.linearPositionToValue;
        if (this.options.customPositionToValue)
          fn = this.options.customPositionToValue;
        else if (this.options.logScale)
          fn = this.logPositionToValue;
        return fn(percent, this.minValue, this.maxValue) || 0;
      },

      linearPositionToValue: function(percent, minVal, maxVal) {
        return percent * (maxVal - minVal) + minVal;
      },

      logPositionToValue: function(percent, minVal, maxVal) {
        minVal = Math.log(minVal);
        maxVal = Math.log(maxVal);
        var value = percent * (maxVal - minVal) + minVal;
        return Math.exp(value);
      },

      // Events
      /**
       * Get the X-coordinate or Y-coordinate of an event
       *
       * @param {Object} event  The event
       * @returns {number}
       */
      getEventXY: function(event) {
        /* http://stackoverflow.com/a/12336075/282882 */
        //noinspection JSLint
        var clientXY = this.options.vertical ? 'clientY' : 'clientX';
        if (event[clientXY] !== undefined) {
          return event[clientXY];
        }

        return event.originalEvent === undefined ?
          event.touches[0][clientXY] : event.originalEvent.touches[0][clientXY];
      },

      /**
       * Compute the event position depending on whether the slider is horizontal or vertical
       * @param event
       * @returns {number}
       */
      getEventPosition: function(event) {
        var sliderPos = this.sliderElem.rzsp,
          eventPos = 0;
        if (this.options.vertical)
          eventPos = -this.getEventXY(event) + sliderPos;
        else
          eventPos = this.getEventXY(event) - sliderPos;
        return eventPos * this.options.scale - this.handleHalfDim; // #346 handleHalfDim is already scaled
      },

      /**
       * Get event names for move and event end
       *
       * @param {Event}    event    The event
       *
       * @return {{moveEvent: string, endEvent: string}}
       */
      getEventNames: function(event) {
        var eventNames = {
          moveEvent: '',
          endEvent: ''
        };

        if (event.touches || (event.originalEvent !== undefined && event.originalEvent.touches)) {
          eventNames.moveEvent = 'touchmove';
          eventNames.endEvent = 'touchend';
        } else {
          eventNames.moveEvent = 'mousemove';
          eventNames.endEvent = 'mouseup';
        }

        return eventNames;
      },

      /**
       * Get the handle closest to an event.
       *
       * @param event {Event} The event
       * @returns {jqLite} The handle closest to the event.
       */
      getNearestHandle: function(event) {
        if (!this.range) {
          return this.minH;
        }
        var position = this.getEventPosition(event),
          distanceMin = Math.abs(position - this.minH.rzsp),
          distanceMax = Math.abs(position - this.maxH.rzsp);
        if (distanceMin < distanceMax)
          return this.minH;
        else if (distanceMin > distanceMax)
          return this.maxH;
        else if (!this.options.rightToLeft)
        //if event is at the same distance from min/max then if it's at left of minH, we return minH else maxH
          return position < this.minH.rzsp ? this.minH : this.maxH;
        else
        //reverse in rtl
          return position > this.minH.rzsp ? this.minH : this.maxH;
      },

      /**
       * Wrapper function to focus an angular element
       *
       * @param el {AngularElement} the element to focus
       */
      focusElement: function(el) {
        var DOM_ELEMENT = 0;
        el[DOM_ELEMENT].focus();
      },

      /**
       * Bind mouse and touch events to slider handles
       *
       * @returns {undefined}
       */
      bindEvents: function() {
        var barTracking, barStart, barMove;

        if (this.options.draggableRange) {
          barTracking = 'rzSliderDrag';
          barStart = this.onDragStart;
          barMove = this.onDragMove;
        } else {
          barTracking = 'lowValue';
          barStart = this.onStart;
          barMove = this.onMove;
        }

        if (!this.options.onlyBindHandles) {
          this.selBar.on('mousedown', angular.bind(this, barStart, null, barTracking));
          this.selBar.on('mousedown', angular.bind(this, barMove, this.selBar));
        }

        if (this.options.draggableRangeOnly) {
          this.minH.on('mousedown', angular.bind(this, barStart, null, barTracking));
          this.maxH.on('mousedown', angular.bind(this, barStart, null, barTracking));
        } else {
          this.minH.on('mousedown', angular.bind(this, this.onStart, this.minH, 'lowValue'));
          if (this.range) {
            this.maxH.on('mousedown', angular.bind(this, this.onStart, this.maxH, 'highValue'));
          }
          if (!this.options.onlyBindHandles) {
            this.fullBar.on('mousedown', angular.bind(this, this.onStart, null, null));
            this.fullBar.on('mousedown', angular.bind(this, this.onMove, this.fullBar));
            this.ticks.on('mousedown', angular.bind(this, this.onStart, null, null));
            this.ticks.on('mousedown', angular.bind(this, this.onTickClick, this.ticks));
          }
        }

        if (!this.options.onlyBindHandles) {
          this.selBar.on('touchstart', angular.bind(this, barStart, null, barTracking));
          this.selBar.on('touchstart', angular.bind(this, barMove, this.selBar));
        }
        if (this.options.draggableRangeOnly) {
          this.minH.on('touchstart', angular.bind(this, barStart, null, barTracking));
          this.maxH.on('touchstart', angular.bind(this, barStart, null, barTracking));
        } else {
          this.minH.on('touchstart', angular.bind(this, this.onStart, this.minH, 'lowValue'));
          if (this.range) {
            this.maxH.on('touchstart', angular.bind(this, this.onStart, this.maxH, 'highValue'));
          }
          if (!this.options.onlyBindHandles) {
            this.fullBar.on('touchstart', angular.bind(this, this.onStart, null, null));
            this.fullBar.on('touchstart', angular.bind(this, this.onMove, this.fullBar));
            this.ticks.on('touchstart', angular.bind(this, this.onStart, null, null));
            this.ticks.on('touchstart', angular.bind(this, this.onTickClick, this.ticks));
          }
        }

        if (this.options.keyboardSupport) {
          this.minH.on('focus', angular.bind(this, this.onPointerFocus, this.minH, 'lowValue'));
          if (this.range) {
            this.maxH.on('focus', angular.bind(this, this.onPointerFocus, this.maxH, 'highValue'));
          }
        }
      },

      /**
       * Unbind mouse and touch events to slider handles
       *
       * @returns {undefined}
       */
      unbindEvents: function() {
        this.minH.off();
        this.maxH.off();
        this.fullBar.off();
        this.selBar.off();
        this.ticks.off();
      },

      /**
       * onStart event handler
       *
       * @param {?Object} pointer The jqLite wrapped DOM element; if null, the closest handle is used
       * @param {?string} ref     The name of the handle being changed; if null, the closest handle's value is modified
       * @param {Event}   event   The event
       * @returns {undefined}
       */
      onStart: function(pointer, ref, event) {
        var ehMove, ehEnd,
          eventNames = this.getEventNames(event);

        event.stopPropagation();
        event.preventDefault();

        // We have to do this in case the HTML where the sliders are on
        // have been animated into view.
        this.calcViewDimensions();

        if (pointer) {
          this.tracking = ref;
        } else {
          pointer = this.getNearestHandle(event);
          this.tracking = pointer === this.minH ? 'lowValue' : 'highValue';
        }

        pointer.addClass('rz-active');

        if (this.options.keyboardSupport)
          this.focusElement(pointer);

        ehMove = angular.bind(this, this.dragging.active ? this.onDragMove : this.onMove, pointer);
        ehEnd = angular.bind(this, this.onEnd, ehMove);

        $document.on(eventNames.moveEvent, ehMove);
        $document.one(eventNames.endEvent, ehEnd);
        this.callOnStart();
      },

      /**
       * onMove event handler
       *
       * @param {jqLite} pointer
       * @param {Event}  event The event
       * @param {boolean}  fromTick if the event occured on a tick or not
       * @returns {undefined}
       */
      onMove: function(pointer, event, fromTick) {
        var newPos = this.getEventPosition(event),
          newValue,
          ceilValue = this.options.rightToLeft ? this.minValue : this.maxValue,
          flrValue = this.options.rightToLeft ? this.maxValue : this.minValue;

        if (newPos <= 0) {
          newValue = flrValue;
        } else if (newPos >= this.maxPos) {
          newValue = ceilValue;
        } else {
          newValue = this.positionToValue(newPos);
          if (fromTick && angular.isNumber(this.options.showTicks))
            newValue = this.roundStep(newValue, this.options.showTicks);
          else
            newValue = this.roundStep(newValue);
        }
        this.positionTrackingHandle(newValue);
      },

      /**
       * onEnd event handler
       *
       * @param {Event}    event    The event
       * @param {Function} ehMove   The the bound move event handler
       * @returns {undefined}
       */
      onEnd: function(ehMove, event) {
        var moveEventName = this.getEventNames(event).moveEvent;

        if (!this.options.keyboardSupport) {
          this.minH.removeClass('rz-active');
          this.maxH.removeClass('rz-active');
          this.tracking = '';
        }
        this.dragging.active = false;

        $document.off(moveEventName, ehMove);
        this.callOnEnd();
      },

      onTickClick: function(pointer, event) {
        this.onMove(pointer, event, true);
      },

      onPointerFocus: function(pointer, ref) {
        this.tracking = ref;
        pointer.one('blur', angular.bind(this, this.onPointerBlur, pointer));
        pointer.on('keydown', angular.bind(this, this.onKeyboardEvent));
        pointer.on('keyup', angular.bind(this, this.onKeyUp));
        this.firstKeyDown = true;
        pointer.addClass('rz-active');

        this.currentFocusElement = {
          pointer: pointer,
          ref: ref
        };
      },

      onKeyUp: function() {
        this.firstKeyDown = true;
        this.callOnEnd();
      },

      onPointerBlur: function(pointer) {
        pointer.off('keydown');
        pointer.off('keyup');
        this.tracking = '';
        pointer.removeClass('rz-active');
        this.currentFocusElement = null
      },

      /**
       * Key actions helper function
       *
       * @param {number} currentValue value of the slider
       *
       * @returns {?Object} action value mappings
       */
      getKeyActions: function(currentValue) {
        var increaseStep = currentValue + this.step,
          decreaseStep = currentValue - this.step,
          increasePage = currentValue + this.valueRange / 10,
          decreasePage = currentValue - this.valueRange / 10;

        //Left to right default actions
        var actions = {
          'UP': increaseStep,
          'DOWN': decreaseStep,
          'LEFT': decreaseStep,
          'RIGHT': increaseStep,
          'PAGEUP': increasePage,
          'PAGEDOWN': decreasePage,
          'HOME': this.minValue,
          'END': this.maxValue
        };
        //right to left means swapping right and left arrows
        if (this.options.rightToLeft) {
          actions.LEFT = increaseStep;
          actions.RIGHT = decreaseStep;
          // right to left and vertical means we also swap up and down
          if (this.options.vertical) {
            actions.UP = decreaseStep;
            actions.DOWN = increaseStep;
          }
        }
        return actions;
      },

      onKeyboardEvent: function(event) {
        var currentValue = this[this.tracking],
          keyCode = event.keyCode || event.which,
          keys = {
            38: 'UP',
            40: 'DOWN',
            37: 'LEFT',
            39: 'RIGHT',
            33: 'PAGEUP',
            34: 'PAGEDOWN',
            36: 'HOME',
            35: 'END'
          },
          actions = this.getKeyActions(currentValue),
          key = keys[keyCode],
          action = actions[key];
        if (action == null || this.tracking === '') return;
        event.preventDefault();

        if (this.firstKeyDown) {
          this.firstKeyDown = false;
          this.callOnStart();
        }

        var self = this;
        $timeout(function() {
          var newValue = self.roundStep(self.sanitizeValue(action));
          if (!self.options.draggableRangeOnly) {
            self.positionTrackingHandle(newValue);
          }
          else {
            var difference = self.highValue - self.lowValue,
              newMinValue, newMaxValue;
            if (self.tracking === 'lowValue') {
              newMinValue = newValue;
              newMaxValue = newValue + difference;
              if (newMaxValue > self.maxValue) {
                newMaxValue = self.maxValue;
                newMinValue = newMaxValue - difference;
              }
            } else {
              newMaxValue = newValue;
              newMinValue = newValue - difference;
              if (newMinValue < self.minValue) {
                newMinValue = self.minValue;
                newMaxValue = newMinValue + difference;
              }
            }
            self.positionTrackingBar(newMinValue, newMaxValue);
          }
        });
      },

      /**
       * onDragStart event handler
       *
       * Handles dragging of the middle bar.
       *
       * @param {Object} pointer The jqLite wrapped DOM element
       * @param {string} ref     One of the refLow, refHigh values
       * @param {Event}  event   The event
       * @returns {undefined}
       */
      onDragStart: function(pointer, ref, event) {
        var position = this.getEventPosition(event);
        this.dragging = {
          active: true,
          value: this.positionToValue(position),
          difference: this.highValue - this.lowValue,
          lowLimit: this.options.rightToLeft ? this.minH.rzsp - position : position - this.minH.rzsp,
          highLimit: this.options.rightToLeft ? position - this.maxH.rzsp : this.maxH.rzsp - position
        };

        this.onStart(pointer, ref, event);
      },

      /**
       * getValue helper function
       *
       * gets max or min value depending on whether the newPos is outOfBounds above or below the bar and rightToLeft
       *
       * @param {string} type 'max' || 'min' The value we are calculating
       * @param {number} newPos  The new position
       * @param {boolean} outOfBounds Is the new position above or below the max/min?
       * @param {boolean} isAbove Is the new position above the bar if out of bounds?
       *
       * @returns {number}
       */
      getValue: function(type, newPos, outOfBounds, isAbove) {
        var isRTL = this.options.rightToLeft,
          value = null;

        if (type === 'min') {
          if (outOfBounds) {
            if (isAbove) {
              value = isRTL ? this.minValue : this.maxValue - this.dragging.difference;
            } else {
              value = isRTL ? this.maxValue - this.dragging.difference : this.minValue;
            }
          } else {
            value = isRTL ? this.positionToValue(newPos + this.dragging.lowLimit) : this.positionToValue(newPos - this.dragging.lowLimit)
          }
        } else {
          if (outOfBounds) {
            if (isAbove) {
              value = isRTL ? this.minValue + this.dragging.difference : this.maxValue;
            } else {
              value = isRTL ? this.maxValue : this.minValue + this.dragging.difference;
            }
          } else {
            if (isRTL) {
              value = this.positionToValue(newPos + this.dragging.lowLimit) + this.dragging.difference
            } else {
              value = this.positionToValue(newPos - this.dragging.lowLimit) + this.dragging.difference;
            }
          }
        }
        return this.roundStep(value);
      },

      /**
       * onDragMove event handler
       *
       * Handles dragging of the middle bar.
       *
       * @param {jqLite} pointer
       * @param {Event}  event The event
       * @returns {undefined}
       */
      onDragMove: function(pointer, event) {
        var newPos = this.getEventPosition(event),
          newMinValue, newMaxValue,
          ceilLimit, flrLimit,
          isUnderFlrLimit, isOverCeilLimit,
          flrH, ceilH;

        if (this.options.rightToLeft) {
          ceilLimit = this.dragging.lowLimit;
          flrLimit = this.dragging.highLimit;
          flrH = this.maxH;
          ceilH = this.minH;
        } else {
          ceilLimit = this.dragging.highLimit;
          flrLimit = this.dragging.lowLimit;
          flrH = this.minH;
          ceilH = this.maxH;
        }
        isUnderFlrLimit = newPos <= flrLimit;
        isOverCeilLimit = newPos >= this.maxPos - ceilLimit;

        if (isUnderFlrLimit) {
          if (flrH.rzsp === 0)
            return;
          newMinValue = this.getValue('min', newPos, true, false);
          newMaxValue = this.getValue('max', newPos, true, false);
        } else if (isOverCeilLimit) {
          if (ceilH.rzsp === this.maxPos)
            return;
          newMaxValue = this.getValue('max', newPos, true, true);
          newMinValue = this.getValue('min', newPos, true, true);
        } else {
          newMinValue = this.getValue('min', newPos, false);
          newMaxValue = this.getValue('max', newPos, false);
        }
        this.positionTrackingBar(newMinValue, newMaxValue);
      },

      /**
       * Set the new value and position for the entire bar
       *
       * @param {number} newMinValue   the new minimum value
       * @param {number} newMaxValue   the new maximum value
       */
      positionTrackingBar: function(newMinValue, newMaxValue) {

        if (this.options.minLimit != null && newMinValue < this.options.minLimit) {
          newMinValue = this.options.minLimit;
          newMaxValue = newMinValue + this.dragging.difference;
        }
        if (this.options.maxLimit != null && newMaxValue > this.options.maxLimit) {
          newMaxValue = this.options.maxLimit;
          newMinValue = newMaxValue - this.dragging.difference;
        }

        this.lowValue = newMinValue;
        this.highValue = newMaxValue;
        this.applyLowValue();
        if (this.range)
          this.applyHighValue();
        this.applyModel();
        this.updateHandles('lowValue', this.valueToPosition(newMinValue));
        this.updateHandles('highValue', this.valueToPosition(newMaxValue));
      },

      /**
       * Set the new value and position to the current tracking handle
       *
       * @param {number} newValue new model value
       */
      positionTrackingHandle: function(newValue) {
        var valueChanged = false;

        newValue = this.applyMinMaxLimit(newValue);
        if (this.range) {
          if (this.options.pushRange) {
            newValue = this.applyPushRange(newValue);
            valueChanged = true;
          }
          else {
            if (this.options.noSwitching) {
              if (this.tracking === 'lowValue' && newValue > this.highValue)
                newValue = this.applyMinMaxRange(this.highValue);
              else if (this.tracking === 'highValue' && newValue < this.lowValue)
                newValue = this.applyMinMaxRange(this.lowValue);
            }
            newValue = this.applyMinMaxRange(newValue);
            /* This is to check if we need to switch the min and max handles */
            if (this.tracking === 'lowValue' && newValue > this.highValue) {
              this.lowValue = this.highValue;
              this.applyLowValue();
              this.updateHandles(this.tracking, this.maxH.rzsp);
              this.updateAriaAttributes();
              this.tracking = 'highValue';
              this.minH.removeClass('rz-active');
              this.maxH.addClass('rz-active');
              if (this.options.keyboardSupport)
                this.focusElement(this.maxH);
              valueChanged = true;
            }
            else if (this.tracking === 'highValue' && newValue < this.lowValue) {
              this.highValue = this.lowValue;
              this.applyHighValue();
              this.updateHandles(this.tracking, this.minH.rzsp);
              this.updateAriaAttributes();
              this.tracking = 'lowValue';
              this.maxH.removeClass('rz-active');
              this.minH.addClass('rz-active');
              if (this.options.keyboardSupport)
                this.focusElement(this.minH);
              valueChanged = true;
            }
          }
        }

        if (this[this.tracking] !== newValue) {
          this[this.tracking] = newValue;
          if (this.tracking === 'lowValue')
            this.applyLowValue();
          else
            this.applyHighValue();
          this.updateHandles(this.tracking, this.valueToPosition(newValue));
          this.updateAriaAttributes();
          valueChanged = true;
        }

        if (valueChanged)
          this.applyModel();
      },

      applyMinMaxLimit: function(newValue) {
        if (this.options.minLimit != null && newValue < this.options.minLimit)
          return this.options.minLimit;
        if (this.options.maxLimit != null && newValue > this.options.maxLimit)
          return this.options.maxLimit;
        return newValue;
      },

      applyMinMaxRange: function(newValue) {
        var oppositeValue = this.tracking === 'lowValue' ? this.highValue : this.lowValue,
          difference = Math.abs(newValue - oppositeValue);
        if (this.options.minRange != null) {
          if (difference < this.options.minRange) {
            if (this.tracking === 'lowValue')
              return this.highValue - this.options.minRange;
            else
              return this.lowValue + this.options.minRange;
          }
        }
        if (this.options.maxRange != null) {
          if (difference > this.options.maxRange) {
            if (this.tracking === 'lowValue')
              return this.highValue - this.options.maxRange;
            else
              return this.lowValue + this.options.maxRange;
          }
        }
        return newValue;
      },

      applyPushRange: function(newValue) {
        var difference = this.tracking === 'lowValue' ? this.highValue - newValue : newValue - this.lowValue,
          minRange = this.options.minRange !== null ? this.options.minRange : this.options.step,
          maxRange = this.options.maxRange;
        // if smaller than minRange
        if (difference < minRange) {
          if (this.tracking === 'lowValue') {
            this.highValue = Math.min(newValue + minRange, this.maxValue);
            newValue = this.highValue - minRange;
            this.applyHighValue();
            this.updateHandles('highValue', this.valueToPosition(this.highValue));
          }
          else {
            this.lowValue = Math.max(newValue - minRange, this.minValue);
            newValue = this.lowValue + minRange;
            this.applyLowValue();
            this.updateHandles('lowValue', this.valueToPosition(this.lowValue));
          }
          this.updateAriaAttributes();
        }
        // if greater than maxRange
        else if (maxRange !== null && difference > maxRange) {
          if (this.tracking === 'lowValue') {
            this.highValue = newValue + maxRange;
            this.applyHighValue();
            this.updateHandles('highValue', this.valueToPosition(this.highValue));
          }
          else {
            this.lowValue = newValue - maxRange;
            this.applyLowValue();
            this.updateHandles('lowValue', this.valueToPosition(this.lowValue));
          }
          this.updateAriaAttributes();
        }
        return newValue;
      },

      /**
       * Apply the model values using scope.$apply.
       * We wrap it with the internalChange flag to avoid the watchers to be called
       */
      applyModel: function() {
        this.internalChange = true;
        this.scope.$apply();
        this.callOnChange();
        this.internalChange = false;
      },

      /**
       * Call the onStart callback if defined
       * The callback call is wrapped in a $evalAsync to ensure that its result will be applied to the scope.
       *
       * @returns {undefined}
       */
      callOnStart: function() {
        if (this.options.onStart) {
          var self = this,
            pointerType = this.tracking === 'lowValue' ? 'min' : 'max';
          this.scope.$evalAsync(function() {
            self.options.onStart(self.options.id, self.scope.rzSliderModel, self.scope.rzSliderHigh, pointerType);
          });
        }
      },

      /**
       * Call the onChange callback if defined
       * The callback call is wrapped in a $evalAsync to ensure that its result will be applied to the scope.
       *
       * @returns {undefined}
       */
      callOnChange: function() {
        if (this.options.onChange) {
          var self = this,
            pointerType = this.tracking === 'lowValue' ? 'min' : 'max';
          this.scope.$evalAsync(function() {
            self.options.onChange(self.options.id, self.scope.rzSliderModel, self.scope.rzSliderHigh, pointerType);
          });
        }
      },

      /**
       * Call the onEnd callback if defined
       * The callback call is wrapped in a $evalAsync to ensure that its result will be applied to the scope.
       *
       * @returns {undefined}
       */
      callOnEnd: function() {
        if (this.options.onEnd) {
          var self = this,
            pointerType = this.tracking === 'lowValue' ? 'min' : 'max';
          this.scope.$evalAsync(function() {
            self.options.onEnd(self.options.id, self.scope.rzSliderModel, self.scope.rzSliderHigh, pointerType);
          });
        }
        this.scope.$emit('slideEnded');
      }
    };

    return Slider;
  }])

  .directive('rzslider', ['RzSlider', function(RzSlider) {
    'use strict';

    return {
      restrict: 'AE',
      replace: true,
      scope: {
        rzSliderModel: '=?',
        rzSliderHigh: '=?',
        rzSliderOptions: '&?',
        rzSliderTplUrl: '@'
      },

      /**
       * Return template URL
       *
       * @param {jqLite} elem
       * @param {Object} attrs
       * @return {string}
       */
      templateUrl: function(elem, attrs) {
        //noinspection JSUnresolvedVariable
        return attrs.rzSliderTplUrl || 'rzSliderTpl.html';
      },

      link: function(scope, elem) {
        scope.slider = new RzSlider(scope, elem); //attach on scope so we can test it
      }
    };
  }]);

  // IDE assist

  /**
   * @name ngScope
   *
   * @property {number} rzSliderModel
   * @property {number} rzSliderHigh
   * @property {Object} rzSliderOptions
   */

  /**
   * @name jqLite
   *
   * @property {number|undefined} rzsp rzslider label position position
   * @property {number|undefined} rzsd rzslider element dimension
   * @property {string|undefined} rzsv rzslider label value/text
   * @property {Function} css
   * @property {Function} text
   */

  /**
   * @name Event
   * @property {Array} touches
   * @property {Event} originalEvent
   */

  /**
   * @name ThrottleOptions
   *
   * @property {boolean} leading
   * @property {boolean} trailing
   */

  module.run(['$templateCache', function($templateCache) {
  'use strict';

  $templateCache.put('rzSliderTpl.html',
    "<div class=rzslider><span class=rz-bar-wrapper><span class=rz-bar></span></span> <span class=rz-bar-wrapper><span class=\"rz-bar rz-selection\" ng-style=barStyle></span></span> <span class=\"rz-pointer rz-pointer-min\" ng-style=minPointerStyle></span> <span class=\"rz-pointer rz-pointer-max\" ng-style=maxPointerStyle></span> <span class=\"rz-bubble rz-limit rz-floor\"></span> <span class=\"rz-bubble rz-limit rz-ceil\"></span> <span class=rz-bubble></span> <span class=rz-bubble></span> <span class=rz-bubble></span><ul ng-show=showTicks class=rz-ticks><li ng-repeat=\"t in ticks track by $index\" class=rz-tick ng-class=\"{'rz-selected': t.selected}\" ng-style=t.style ng-attr-uib-tooltip=\"{{ t.tooltip }}\" ng-attr-tooltip-placement={{t.tooltipPlacement}} ng-attr-tooltip-append-to-body=\"{{ t.tooltip ? true : undefined}}\"><span ng-if=\"t.value != null\" class=rz-tick-value ng-attr-uib-tooltip=\"{{ t.valueTooltip }}\" ng-attr-tooltip-placement={{t.valueTooltipPlacement}}>{{ t.value }}</span> <span ng-if=\"t.legend != null\" class=rz-tick-legend>{{ t.legend }}</span></li></ul></div>"
  );

}]);

  return module.name
}));

/**
 * Mousetrap wrapper for AngularJS
 * @version v0.0.1 - 2013-12-30
 * @link https://github.com/mgonto/mgo-mousetrap
 * @author Martin Gontovnikas <martin@gon.to>
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
angular.module('mgo-mousetrap', []).directive('wMousetrap', function () {
    return {
        restrict: 'A',
        controller: ['$scope', '$element', '$attrs',
                     function ($scope, $element, $attrs) {
            
            var mousetrap;

            $scope.$watch($attrs.wMousetrap, function(_mousetrap) {
                mousetrap = _mousetrap;

                for (var key in mousetrap) {
                    if (mousetrap.hasOwnProperty(key)) {
                        Mousetrap.unbind(key);
                        Mousetrap.bind(key, applyWrapper(mousetrap[key])); 
                    }
                }
            }, true);
            
            function applyWrapper(func) {
                return function(e) {
                    $scope.$apply(function() {
                        func(e);
                    });
                };
            }
            
            $element.bind('$destroy', function() {
                if (!mousetrap) return;

                for (var key in mousetrap) {
                    if (mousetrap.hasOwnProperty(key)) {
                        Mousetrap.unbind(key);
                    }
                }
            });

        }]
    }
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFuZ3VsYXItbG9jYWwtc3RvcmFnZS5qcyIsImFuZ3VsYXItbWFycXVlZS5qcyIsImFuZ3VsYXIteW91dHViZS1lbWJlZC5qcyIsImFwcC5qcyIsImJhc2UuanMiLCJtb3VzZXRyYXAuanMiLCJyenNsaWRlci5qcyIsIndNb3VzZXRyYXAuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25pQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzVQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM3ZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDejdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDN3dFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoibWl6VUkuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFuIEFuZ3VsYXIgbW9kdWxlIHRoYXQgZ2l2ZXMgeW91IGFjY2VzcyB0byB0aGUgYnJvd3NlcnMgbG9jYWwgc3RvcmFnZVxuICogQHZlcnNpb24gdjAuNS4yIC0gMjAxNi0wOS0yOFxuICogQGxpbmsgaHR0cHM6Ly9naXRodWIuY29tL2dyZXZvcnkvYW5ndWxhci1sb2NhbC1zdG9yYWdlXG4gKiBAYXV0aG9yIGdyZXZvcnkgPGdyZWdAZ3JlZ3Bpa2UuY2E+XG4gKiBAbGljZW5zZSBNSVQgTGljZW5zZSwgaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVRcbiAqL1xuKGZ1bmN0aW9uICh3aW5kb3csIGFuZ3VsYXIpIHtcbnZhciBpc0RlZmluZWQgPSBhbmd1bGFyLmlzRGVmaW5lZCxcbiAgaXNVbmRlZmluZWQgPSBhbmd1bGFyLmlzVW5kZWZpbmVkLFxuICBpc051bWJlciA9IGFuZ3VsYXIuaXNOdW1iZXIsXG4gIGlzT2JqZWN0ID0gYW5ndWxhci5pc09iamVjdCxcbiAgaXNBcnJheSA9IGFuZ3VsYXIuaXNBcnJheSxcbiAgaXNTdHJpbmcgPSBhbmd1bGFyLmlzU3RyaW5nLFxuICBleHRlbmQgPSBhbmd1bGFyLmV4dGVuZCxcbiAgdG9Kc29uID0gYW5ndWxhci50b0pzb247XG5cbmFuZ3VsYXJcbiAgLm1vZHVsZSgnTG9jYWxTdG9yYWdlTW9kdWxlJywgW10pXG4gIC5wcm92aWRlcignbG9jYWxTdG9yYWdlU2VydmljZScsIGZ1bmN0aW9uKCkge1xuICAgIC8vIFlvdSBzaG91bGQgc2V0IGEgcHJlZml4IHRvIGF2b2lkIG92ZXJ3cml0aW5nIGFueSBsb2NhbCBzdG9yYWdlIHZhcmlhYmxlcyBmcm9tIHRoZSByZXN0IG9mIHlvdXIgYXBwXG4gICAgLy8gZS5nLiBsb2NhbFN0b3JhZ2VTZXJ2aWNlUHJvdmlkZXIuc2V0UHJlZml4KCd5b3VyQXBwTmFtZScpO1xuICAgIC8vIFdpdGggcHJvdmlkZXIgeW91IGNhbiB1c2UgY29uZmlnIGFzIHRoaXM6XG4gICAgLy8gbXlBcHAuY29uZmlnKGZ1bmN0aW9uIChsb2NhbFN0b3JhZ2VTZXJ2aWNlUHJvdmlkZXIpIHtcbiAgICAvLyAgICBsb2NhbFN0b3JhZ2VTZXJ2aWNlUHJvdmlkZXIucHJlZml4ID0gJ3lvdXJBcHBOYW1lJztcbiAgICAvLyB9KTtcbiAgICB0aGlzLnByZWZpeCA9ICdscyc7XG5cbiAgICAvLyBZb3UgY291bGQgY2hhbmdlIHdlYiBzdG9yYWdlIHR5cGUgbG9jYWxzdG9yYWdlIG9yIHNlc3Npb25TdG9yYWdlXG4gICAgdGhpcy5zdG9yYWdlVHlwZSA9ICdsb2NhbFN0b3JhZ2UnO1xuXG4gICAgLy8gQ29va2llIG9wdGlvbnMgKHVzdWFsbHkgaW4gY2FzZSBvZiBmYWxsYmFjaylcbiAgICAvLyBleHBpcnkgPSBOdW1iZXIgb2YgZGF5cyBiZWZvcmUgY29va2llcyBleHBpcmUgLy8gMCA9IERvZXMgbm90IGV4cGlyZVxuICAgIC8vIHBhdGggPSBUaGUgd2ViIHBhdGggdGhlIGNvb2tpZSByZXByZXNlbnRzXG4gICAgLy8gc2VjdXJlID0gV2V0aGVyIHRoZSBjb29raWVzIHNob3VsZCBiZSBzZWN1cmUgKGkuZSBvbmx5IHNlbnQgb24gSFRUUFMgcmVxdWVzdHMpXG4gICAgdGhpcy5jb29raWUgPSB7XG4gICAgICBleHBpcnk6IDMwLFxuICAgICAgcGF0aDogJy8nLFxuICAgICAgc2VjdXJlOiBmYWxzZVxuICAgIH07XG5cbiAgICAvLyBEZWNpZGVzIHdldGhlciB3ZSBzaG91bGQgZGVmYXVsdCB0byBjb29raWVzIGlmIGxvY2Fsc3RvcmFnZSBpcyBub3Qgc3VwcG9ydGVkLlxuICAgIHRoaXMuZGVmYXVsdFRvQ29va2llID0gdHJ1ZTtcblxuICAgIC8vIFNlbmQgc2lnbmFscyBmb3IgZWFjaCBvZiB0aGUgZm9sbG93aW5nIGFjdGlvbnM/XG4gICAgdGhpcy5ub3RpZnkgPSB7XG4gICAgICBzZXRJdGVtOiB0cnVlLFxuICAgICAgcmVtb3ZlSXRlbTogZmFsc2VcbiAgICB9O1xuXG4gICAgLy8gU2V0dGVyIGZvciB0aGUgcHJlZml4XG4gICAgdGhpcy5zZXRQcmVmaXggPSBmdW5jdGlvbihwcmVmaXgpIHtcbiAgICAgIHRoaXMucHJlZml4ID0gcHJlZml4O1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIC8vIFNldHRlciBmb3IgdGhlIHN0b3JhZ2VUeXBlXG4gICAgdGhpcy5zZXRTdG9yYWdlVHlwZSA9IGZ1bmN0aW9uKHN0b3JhZ2VUeXBlKSB7XG4gICAgICB0aGlzLnN0b3JhZ2VUeXBlID0gc3RvcmFnZVR5cGU7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuICAgIC8vIFNldHRlciBmb3IgZGVmYXVsdFRvQ29va2llIHZhbHVlLCBkZWZhdWx0IGlzIHRydWUuXG4gICAgdGhpcy5zZXREZWZhdWx0VG9Db29raWUgPSBmdW5jdGlvbiAoc2hvdWxkRGVmYXVsdCkge1xuICAgICAgdGhpcy5kZWZhdWx0VG9Db29raWUgPSAhIXNob3VsZERlZmF1bHQ7IC8vIERvdWJsZS1ub3QgdG8gbWFrZSBzdXJlIGl0J3MgYSBib29sIHZhbHVlLlxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgICAvLyBTZXR0ZXIgZm9yIGNvb2tpZSBjb25maWdcbiAgICB0aGlzLnNldFN0b3JhZ2VDb29raWUgPSBmdW5jdGlvbihleHAsIHBhdGgsIHNlY3VyZSkge1xuICAgICAgdGhpcy5jb29raWUuZXhwaXJ5ID0gZXhwO1xuICAgICAgdGhpcy5jb29raWUucGF0aCA9IHBhdGg7XG4gICAgICB0aGlzLmNvb2tpZS5zZWN1cmUgPSBzZWN1cmU7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgLy8gU2V0dGVyIGZvciBjb29raWUgZG9tYWluXG4gICAgdGhpcy5zZXRTdG9yYWdlQ29va2llRG9tYWluID0gZnVuY3Rpb24oZG9tYWluKSB7XG4gICAgICB0aGlzLmNvb2tpZS5kb21haW4gPSBkb21haW47XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgLy8gU2V0dGVyIGZvciBub3RpZmljYXRpb24gY29uZmlnXG4gICAgLy8gaXRlbVNldCAmIGl0ZW1SZW1vdmUgc2hvdWxkIGJlIGJvb2xlYW5zXG4gICAgdGhpcy5zZXROb3RpZnkgPSBmdW5jdGlvbihpdGVtU2V0LCBpdGVtUmVtb3ZlKSB7XG4gICAgICB0aGlzLm5vdGlmeSA9IHtcbiAgICAgICAgc2V0SXRlbTogaXRlbVNldCxcbiAgICAgICAgcmVtb3ZlSXRlbTogaXRlbVJlbW92ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICB0aGlzLiRnZXQgPSBbJyRyb290U2NvcGUnLCAnJHdpbmRvdycsICckZG9jdW1lbnQnLCAnJHBhcnNlJywnJHRpbWVvdXQnLCBmdW5jdGlvbigkcm9vdFNjb3BlLCAkd2luZG93LCAkZG9jdW1lbnQsICRwYXJzZSwgJHRpbWVvdXQpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIHZhciBwcmVmaXggPSBzZWxmLnByZWZpeDtcbiAgICAgIHZhciBjb29raWUgPSBzZWxmLmNvb2tpZTtcbiAgICAgIHZhciBub3RpZnkgPSBzZWxmLm5vdGlmeTtcbiAgICAgIHZhciBzdG9yYWdlVHlwZSA9IHNlbGYuc3RvcmFnZVR5cGU7XG4gICAgICB2YXIgd2ViU3RvcmFnZTtcblxuICAgICAgLy8gV2hlbiBBbmd1bGFyJ3MgJGRvY3VtZW50IGlzIG5vdCBhdmFpbGFibGVcbiAgICAgIGlmICghJGRvY3VtZW50KSB7XG4gICAgICAgICRkb2N1bWVudCA9IGRvY3VtZW50O1xuICAgICAgfSBlbHNlIGlmICgkZG9jdW1lbnRbMF0pIHtcbiAgICAgICAgJGRvY3VtZW50ID0gJGRvY3VtZW50WzBdO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB0aGVyZSBpcyBhIHByZWZpeCBzZXQgaW4gdGhlIGNvbmZpZyBsZXRzIHVzZSB0aGF0IHdpdGggYW4gYXBwZW5kZWQgcGVyaW9kIGZvciByZWFkYWJpbGl0eVxuICAgICAgaWYgKHByZWZpeC5zdWJzdHIoLTEpICE9PSAnLicpIHtcbiAgICAgICAgcHJlZml4ID0gISFwcmVmaXggPyBwcmVmaXggKyAnLicgOiAnJztcbiAgICAgIH1cbiAgICAgIHZhciBkZXJpdmVRdWFsaWZpZWRLZXkgPSBmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgcmV0dXJuIHByZWZpeCArIGtleTtcbiAgICAgIH07XG5cbiAgICAgIC8vIFJlbW92ZXMgcHJlZml4IGZyb20gdGhlIGtleS5cbiAgICAgIHZhciB1bmRlcml2ZVF1YWxpZmllZEtleSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgcmV0dXJuIGtleS5yZXBsYWNlKG5ldyBSZWdFeHAoJ14nICsgcHJlZml4LCAnZycpLCAnJyk7XG4gICAgICB9O1xuXG4gICAgICAvLyBDaGVjayBpZiB0aGUga2V5IGlzIHdpdGhpbiBvdXIgcHJlZml4IG5hbWVzcGFjZS5cbiAgICAgIHZhciBpc0tleVByZWZpeE91cnMgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHJldHVybiBrZXkuaW5kZXhPZihwcmVmaXgpID09PSAwO1xuICAgICAgfTtcblxuICAgICAgLy8gQ2hlY2tzIHRoZSBicm93c2VyIHRvIHNlZSBpZiBsb2NhbCBzdG9yYWdlIGlzIHN1cHBvcnRlZFxuICAgICAgdmFyIGNoZWNrU3VwcG9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB2YXIgc3VwcG9ydGVkID0gKHN0b3JhZ2VUeXBlIGluICR3aW5kb3cgJiYgJHdpbmRvd1tzdG9yYWdlVHlwZV0gIT09IG51bGwpO1xuXG4gICAgICAgICAgLy8gV2hlbiBTYWZhcmkgKE9TIFggb3IgaU9TKSBpcyBpbiBwcml2YXRlIGJyb3dzaW5nIG1vZGUsIGl0IGFwcGVhcnMgYXMgdGhvdWdoIGxvY2FsU3RvcmFnZVxuICAgICAgICAgIC8vIGlzIGF2YWlsYWJsZSwgYnV0IHRyeWluZyB0byBjYWxsIC5zZXRJdGVtIHRocm93cyBhbiBleGNlcHRpb24uXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBcIlFVT1RBX0VYQ0VFREVEX0VSUjogRE9NIEV4Y2VwdGlvbiAyMjogQW4gYXR0ZW1wdCB3YXMgbWFkZSB0byBhZGQgc29tZXRoaW5nIHRvIHN0b3JhZ2VcbiAgICAgICAgICAvLyB0aGF0IGV4Y2VlZGVkIHRoZSBxdW90YS5cIlxuICAgICAgICAgIHZhciBrZXkgPSBkZXJpdmVRdWFsaWZpZWRLZXkoJ19fJyArIE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIDFlNykpO1xuICAgICAgICAgIGlmIChzdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgIHdlYlN0b3JhZ2UgPSAkd2luZG93W3N0b3JhZ2VUeXBlXTtcbiAgICAgICAgICAgIHdlYlN0b3JhZ2Uuc2V0SXRlbShrZXksICcnKTtcbiAgICAgICAgICAgIHdlYlN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBzdXBwb3J0ZWQ7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAvLyBPbmx5IGNoYW5nZSBzdG9yYWdlVHlwZSB0byBjb29raWVzIGlmIGRlZmF1bHRpbmcgaXMgZW5hYmxlZC5cbiAgICAgICAgICBpZiAoc2VsZi5kZWZhdWx0VG9Db29raWUpXG4gICAgICAgICAgICBzdG9yYWdlVHlwZSA9ICdjb29raWUnO1xuICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5lcnJvcicsIGUubWVzc2FnZSk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgdmFyIGJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSA9IGNoZWNrU3VwcG9ydCgpO1xuXG4gICAgICAvLyBEaXJlY3RseSBhZGRzIGEgdmFsdWUgdG8gbG9jYWwgc3RvcmFnZVxuICAgICAgLy8gSWYgbG9jYWwgc3RvcmFnZSBpcyBub3QgYXZhaWxhYmxlIGluIHRoZSBicm93c2VyIHVzZSBjb29raWVzXG4gICAgICAvLyBFeGFtcGxlIHVzZTogbG9jYWxTdG9yYWdlU2VydmljZS5hZGQoJ2xpYnJhcnknLCdhbmd1bGFyJyk7XG4gICAgICB2YXIgYWRkVG9Mb2NhbFN0b3JhZ2UgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSwgdHlwZSkge1xuICAgICAgICBzZXRTdG9yYWdlVHlwZSh0eXBlKTtcblxuICAgICAgICAvLyBMZXQncyBjb252ZXJ0IHVuZGVmaW5lZCB2YWx1ZXMgdG8gbnVsbCB0byBnZXQgdGhlIHZhbHVlIGNvbnNpc3RlbnRcbiAgICAgICAgaWYgKGlzVW5kZWZpbmVkKHZhbHVlKSkge1xuICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9IHRvSnNvbih2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiB0aGlzIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBsb2NhbCBzdG9yYWdlIHVzZSBjb29raWVzXG4gICAgICAgIGlmICghYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlICYmIHNlbGYuZGVmYXVsdFRvQ29va2llIHx8IHNlbGYuc3RvcmFnZVR5cGUgPT09ICdjb29raWUnKSB7XG4gICAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi53YXJuaW5nJywgJ0xPQ0FMX1NUT1JBR0VfTk9UX1NVUFBPUlRFRCcpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChub3RpZnkuc2V0SXRlbSkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLnNldGl0ZW0nLCB7a2V5OiBrZXksIG5ld3ZhbHVlOiB2YWx1ZSwgc3RvcmFnZVR5cGU6ICdjb29raWUnfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBhZGRUb0Nvb2tpZXMoa2V5LCB2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGlmICh3ZWJTdG9yYWdlKSB7XG4gICAgICAgICAgICB3ZWJTdG9yYWdlLnNldEl0ZW0oZGVyaXZlUXVhbGlmaWVkS2V5KGtleSksIHZhbHVlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG5vdGlmeS5zZXRJdGVtKSB7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24uc2V0aXRlbScsIHtrZXk6IGtleSwgbmV3dmFsdWU6IHZhbHVlLCBzdG9yYWdlVHlwZTogc2VsZi5zdG9yYWdlVHlwZX0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5lcnJvcicsIGUubWVzc2FnZSk7XG4gICAgICAgICAgcmV0dXJuIGFkZFRvQ29va2llcyhrZXksIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH07XG5cbiAgICAgIC8vIERpcmVjdGx5IGdldCBhIHZhbHVlIGZyb20gbG9jYWwgc3RvcmFnZVxuICAgICAgLy8gRXhhbXBsZSB1c2U6IGxvY2FsU3RvcmFnZVNlcnZpY2UuZ2V0KCdsaWJyYXJ5Jyk7IC8vIHJldHVybnMgJ2FuZ3VsYXInXG4gICAgICB2YXIgZ2V0RnJvbUxvY2FsU3RvcmFnZSA9IGZ1bmN0aW9uIChrZXksIHR5cGUpIHtcbiAgICAgICAgc2V0U3RvcmFnZVR5cGUodHlwZSk7XG5cbiAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UgJiYgc2VsZi5kZWZhdWx0VG9Db29raWUgIHx8IHNlbGYuc3RvcmFnZVR5cGUgPT09ICdjb29raWUnKSB7XG4gICAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi53YXJuaW5nJywgJ0xPQ0FMX1NUT1JBR0VfTk9UX1NVUFBPUlRFRCcpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBnZXRGcm9tQ29va2llcyhrZXkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGl0ZW0gPSB3ZWJTdG9yYWdlID8gd2ViU3RvcmFnZS5nZXRJdGVtKGRlcml2ZVF1YWxpZmllZEtleShrZXkpKSA6IG51bGw7XG4gICAgICAgIC8vIGFuZ3VsYXIudG9Kc29uIHdpbGwgY29udmVydCBudWxsIHRvICdudWxsJywgc28gYSBwcm9wZXIgY29udmVyc2lvbiBpcyBuZWVkZWRcbiAgICAgICAgLy8gRklYTUUgbm90IGEgcGVyZmVjdCBzb2x1dGlvbiwgc2luY2UgYSB2YWxpZCAnbnVsbCcgc3RyaW5nIGNhbid0IGJlIHN0b3JlZFxuICAgICAgICBpZiAoIWl0ZW0gfHwgaXRlbSA9PT0gJ251bGwnKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKGl0ZW0pO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIC8vIFJlbW92ZSBhbiBpdGVtIGZyb20gbG9jYWwgc3RvcmFnZVxuICAgICAgLy8gRXhhbXBsZSB1c2U6IGxvY2FsU3RvcmFnZVNlcnZpY2UucmVtb3ZlKCdsaWJyYXJ5Jyk7IC8vIHJlbW92ZXMgdGhlIGtleS92YWx1ZSBwYWlyIG9mIGxpYnJhcnk9J2FuZ3VsYXInXG4gICAgICAvL1xuICAgICAgLy8gVGhpcyBpcyB2YXItYXJnIHJlbW92YWwsIGNoZWNrIHRoZSBsYXN0IGFyZ3VtZW50IHRvIHNlZSBpZiBpdCBpcyBhIHN0b3JhZ2VUeXBlXG4gICAgICAvLyBhbmQgc2V0IHR5cGUgYWNjb3JkaW5nbHkgYmVmb3JlIHJlbW92aW5nLlxuICAgICAgLy9cbiAgICAgIHZhciByZW1vdmVGcm9tTG9jYWxTdG9yYWdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBjYW4ndCBwb3Agb24gYXJndW1lbnRzLCBzbyB3ZSBkbyB0aGlzXG4gICAgICAgIHZhciBjb25zdW1lZCA9IDA7XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID49IDEgJiZcbiAgICAgICAgICAgIChhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdID09PSAnbG9jYWxTdG9yYWdlJyB8fFxuICAgICAgICAgICAgIGFyZ3VtZW50c1thcmd1bWVudHMubGVuZ3RoIC0gMV0gPT09ICdzZXNzaW9uU3RvcmFnZScpKSB7XG4gICAgICAgICAgY29uc3VtZWQgPSAxO1xuICAgICAgICAgIHNldFN0b3JhZ2VUeXBlKGFyZ3VtZW50c1thcmd1bWVudHMubGVuZ3RoIC0gMV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGksIGtleTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSBjb25zdW1lZDsgaSsrKSB7XG4gICAgICAgICAga2V5ID0gYXJndW1lbnRzW2ldO1xuICAgICAgICAgIGlmICghYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlICYmIHNlbGYuZGVmYXVsdFRvQ29va2llIHx8IHNlbGYuc3RvcmFnZVR5cGUgPT09ICdjb29raWUnKSB7XG4gICAgICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSkge1xuICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24ud2FybmluZycsICdMT0NBTF9TVE9SQUdFX05PVF9TVVBQT1JURUQnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG5vdGlmeS5yZW1vdmVJdGVtKSB7XG4gICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5yZW1vdmVpdGVtJywge2tleToga2V5LCBzdG9yYWdlVHlwZTogJ2Nvb2tpZSd9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlbW92ZUZyb21Db29raWVzKGtleSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgd2ViU3RvcmFnZS5yZW1vdmVJdGVtKGRlcml2ZVF1YWxpZmllZEtleShrZXkpKTtcbiAgICAgICAgICAgICAgaWYgKG5vdGlmeS5yZW1vdmVJdGVtKSB7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLnJlbW92ZWl0ZW0nLCB7XG4gICAgICAgICAgICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgICAgICAgICAgIHN0b3JhZ2VUeXBlOiBzZWxmLnN0b3JhZ2VUeXBlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLmVycm9yJywgZS5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgcmVtb3ZlRnJvbUNvb2tpZXMoa2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIC8vIFJldHVybiBhcnJheSBvZiBrZXlzIGZvciBsb2NhbCBzdG9yYWdlXG4gICAgICAvLyBFeGFtcGxlIHVzZTogdmFyIGtleXMgPSBsb2NhbFN0b3JhZ2VTZXJ2aWNlLmtleXMoKVxuICAgICAgdmFyIGdldEtleXNGb3JMb2NhbFN0b3JhZ2UgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICBzZXRTdG9yYWdlVHlwZSh0eXBlKTtcblxuICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSkge1xuICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi53YXJuaW5nJywgJ0xPQ0FMX1NUT1JBR0VfTk9UX1NVUFBPUlRFRCcpO1xuICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBwcmVmaXhMZW5ndGggPSBwcmVmaXgubGVuZ3RoO1xuICAgICAgICB2YXIga2V5cyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBrZXkgaW4gd2ViU3RvcmFnZSkge1xuICAgICAgICAgIC8vIE9ubHkgcmV0dXJuIGtleXMgdGhhdCBhcmUgZm9yIHRoaXMgYXBwXG4gICAgICAgICAgaWYgKGtleS5zdWJzdHIoMCwgcHJlZml4TGVuZ3RoKSA9PT0gcHJlZml4KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBrZXlzLnB1c2goa2V5LnN1YnN0cihwcmVmaXhMZW5ndGgpKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLmVycm9yJywgZS5EZXNjcmlwdGlvbik7XG4gICAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGtleXM7XG4gICAgICB9O1xuXG4gICAgICAvLyBSZW1vdmUgYWxsIGRhdGEgZm9yIHRoaXMgYXBwIGZyb20gbG9jYWwgc3RvcmFnZVxuICAgICAgLy8gQWxzbyBvcHRpb25hbGx5IHRha2VzIGEgcmVndWxhciBleHByZXNzaW9uIHN0cmluZyBhbmQgcmVtb3ZlcyB0aGUgbWF0Y2hpbmcga2V5LXZhbHVlIHBhaXJzXG4gICAgICAvLyBFeGFtcGxlIHVzZTogbG9jYWxTdG9yYWdlU2VydmljZS5jbGVhckFsbCgpO1xuICAgICAgLy8gU2hvdWxkIGJlIHVzZWQgbW9zdGx5IGZvciBkZXZlbG9wbWVudCBwdXJwb3Nlc1xuICAgICAgdmFyIGNsZWFyQWxsRnJvbUxvY2FsU3RvcmFnZSA9IGZ1bmN0aW9uIChyZWd1bGFyRXhwcmVzc2lvbiwgdHlwZSkge1xuICAgICAgICBzZXRTdG9yYWdlVHlwZSh0eXBlKTtcblxuICAgICAgICAvLyBTZXR0aW5nIGJvdGggcmVndWxhciBleHByZXNzaW9ucyBpbmRlcGVuZGVudGx5XG4gICAgICAgIC8vIEVtcHR5IHN0cmluZ3MgcmVzdWx0IGluIGNhdGNoYWxsIFJlZ0V4cFxuICAgICAgICB2YXIgcHJlZml4UmVnZXggPSAhIXByZWZpeCA/IG5ldyBSZWdFeHAoJ14nICsgcHJlZml4KSA6IG5ldyBSZWdFeHAoKTtcbiAgICAgICAgdmFyIHRlc3RSZWdleCA9ICEhcmVndWxhckV4cHJlc3Npb24gPyBuZXcgUmVnRXhwKHJlZ3VsYXJFeHByZXNzaW9uKSA6IG5ldyBSZWdFeHAoKTtcblxuICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSAmJiBzZWxmLmRlZmF1bHRUb0Nvb2tpZSAgfHwgc2VsZi5zdG9yYWdlVHlwZSA9PT0gJ2Nvb2tpZScpIHtcbiAgICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLndhcm5pbmcnLCAnTE9DQUxfU1RPUkFHRV9OT1RfU1VQUE9SVEVEJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBjbGVhckFsbEZyb21Db29raWVzKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UgJiYgIXNlbGYuZGVmYXVsdFRvQ29va2llKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgdmFyIHByZWZpeExlbmd0aCA9IHByZWZpeC5sZW5ndGg7XG5cbiAgICAgICAgZm9yICh2YXIga2V5IGluIHdlYlN0b3JhZ2UpIHtcbiAgICAgICAgICAvLyBPbmx5IHJlbW92ZSBpdGVtcyB0aGF0IGFyZSBmb3IgdGhpcyBhcHAgYW5kIG1hdGNoIHRoZSByZWd1bGFyIGV4cHJlc3Npb25cbiAgICAgICAgICBpZiAocHJlZml4UmVnZXgudGVzdChrZXkpICYmIHRlc3RSZWdleC50ZXN0KGtleS5zdWJzdHIocHJlZml4TGVuZ3RoKSkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHJlbW92ZUZyb21Mb2NhbFN0b3JhZ2Uoa2V5LnN1YnN0cihwcmVmaXhMZW5ndGgpKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLmVycm9yJywgZS5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGNsZWFyQWxsRnJvbUNvb2tpZXMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9O1xuXG4gICAgICAvLyBDaGVja3MgdGhlIGJyb3dzZXIgdG8gc2VlIGlmIGNvb2tpZXMgYXJlIHN1cHBvcnRlZFxuICAgICAgdmFyIGJyb3dzZXJTdXBwb3J0c0Nvb2tpZXMgPSAoZnVuY3Rpb24oKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmV0dXJuICR3aW5kb3cubmF2aWdhdG9yLmNvb2tpZUVuYWJsZWQgfHxcbiAgICAgICAgICAoXCJjb29raWVcIiBpbiAkZG9jdW1lbnQgJiYgKCRkb2N1bWVudC5jb29raWUubGVuZ3RoID4gMCB8fFxuICAgICAgICAgICAgKCRkb2N1bWVudC5jb29raWUgPSBcInRlc3RcIikuaW5kZXhPZi5jYWxsKCRkb2N1bWVudC5jb29raWUsIFwidGVzdFwiKSA+IC0xKSk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLmVycm9yJywgZS5tZXNzYWdlKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0oKSk7XG5cbiAgICAgICAgLy8gRGlyZWN0bHkgYWRkcyBhIHZhbHVlIHRvIGNvb2tpZXNcbiAgICAgICAgLy8gVHlwaWNhbGx5IHVzZWQgYXMgYSBmYWxsYmFjayBpZiBsb2NhbCBzdG9yYWdlIGlzIG5vdCBhdmFpbGFibGUgaW4gdGhlIGJyb3dzZXJcbiAgICAgICAgLy8gRXhhbXBsZSB1c2U6IGxvY2FsU3RvcmFnZVNlcnZpY2UuY29va2llLmFkZCgnbGlicmFyeScsJ2FuZ3VsYXInKTtcbiAgICAgICAgdmFyIGFkZFRvQ29va2llcyA9IGZ1bmN0aW9uIChrZXksIHZhbHVlLCBkYXlzVG9FeHBpcnksIHNlY3VyZSkge1xuXG4gICAgICAgICAgaWYgKGlzVW5kZWZpbmVkKHZhbHVlKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH0gZWxzZSBpZihpc0FycmF5KHZhbHVlKSB8fCBpc09iamVjdCh2YWx1ZSkpIHtcbiAgICAgICAgICAgIHZhbHVlID0gdG9Kc29uKHZhbHVlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0Nvb2tpZXMpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5lcnJvcicsICdDT09LSUVTX05PVF9TVVBQT1JURUQnKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgdmFyIGV4cGlyeSA9ICcnLFxuICAgICAgICAgICAgZXhwaXJ5RGF0ZSA9IG5ldyBEYXRlKCksXG4gICAgICAgICAgICBjb29raWVEb21haW4gPSAnJztcblxuICAgICAgICAgICAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIC8vIE1hcmsgdGhhdCB0aGUgY29va2llIGhhcyBleHBpcmVkIG9uZSBkYXkgYWdvXG4gICAgICAgICAgICAgIGV4cGlyeURhdGUuc2V0VGltZShleHBpcnlEYXRlLmdldFRpbWUoKSArICgtMSAqIDI0ICogNjAgKiA2MCAqIDEwMDApKTtcbiAgICAgICAgICAgICAgZXhwaXJ5ID0gXCI7IGV4cGlyZXM9XCIgKyBleHBpcnlEYXRlLnRvR01UU3RyaW5nKCk7XG4gICAgICAgICAgICAgIHZhbHVlID0gJyc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzTnVtYmVyKGRheXNUb0V4cGlyeSkgJiYgZGF5c1RvRXhwaXJ5ICE9PSAwKSB7XG4gICAgICAgICAgICAgIGV4cGlyeURhdGUuc2V0VGltZShleHBpcnlEYXRlLmdldFRpbWUoKSArIChkYXlzVG9FeHBpcnkgKiAyNCAqIDYwICogNjAgKiAxMDAwKSk7XG4gICAgICAgICAgICAgIGV4cGlyeSA9IFwiOyBleHBpcmVzPVwiICsgZXhwaXJ5RGF0ZS50b0dNVFN0cmluZygpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjb29raWUuZXhwaXJ5ICE9PSAwKSB7XG4gICAgICAgICAgICAgIGV4cGlyeURhdGUuc2V0VGltZShleHBpcnlEYXRlLmdldFRpbWUoKSArIChjb29raWUuZXhwaXJ5ICogMjQgKiA2MCAqIDYwICogMTAwMCkpO1xuICAgICAgICAgICAgICBleHBpcnkgPSBcIjsgZXhwaXJlcz1cIiArIGV4cGlyeURhdGUudG9HTVRTdHJpbmcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghIWtleSkge1xuICAgICAgICAgICAgICB2YXIgY29va2llUGF0aCA9IFwiOyBwYXRoPVwiICsgY29va2llLnBhdGg7XG4gICAgICAgICAgICAgIGlmIChjb29raWUuZG9tYWluKSB7XG4gICAgICAgICAgICAgICAgY29va2llRG9tYWluID0gXCI7IGRvbWFpbj1cIiArIGNvb2tpZS5kb21haW47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLyogUHJvdmlkaW5nIHRoZSBzZWN1cmUgcGFyYW1ldGVyIGFsd2F5cyB0YWtlcyBwcmVjZWRlbmNlIG92ZXIgY29uZmlnXG4gICAgICAgICAgICAgICAqIChhbGxvd3MgZGV2ZWxvcGVyIHRvIG1peCBhbmQgbWF0Y2ggc2VjdXJlICsgbm9uLXNlY3VyZSkgKi9cbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiBzZWN1cmUgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgICAgICAgaWYgKHNlY3VyZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgIC8qIFdlJ3ZlIGV4cGxpY2l0bHkgc3BlY2lmaWVkIHNlY3VyZSxcbiAgICAgICAgICAgICAgICAgICAgICAgKiBhZGQgdGhlIHNlY3VyZSBhdHRyaWJ1dGUgdG8gdGhlIGNvb2tpZSAoYWZ0ZXIgZG9tYWluKSAqL1xuICAgICAgICAgICAgICAgICAgICAgIGNvb2tpZURvbWFpbiArPSBcIjsgc2VjdXJlXCI7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAvLyBlbHNlIC0gc2VjdXJlIGhhcyBiZWVuIHN1cHBsaWVkIGJ1dCBpc24ndCB0cnVlIC0gc28gZG9uJ3Qgc2V0IHNlY3VyZSBmbGFnLCByZWdhcmRsZXNzIG9mIHdoYXQgY29uZmlnIHNheXNcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbHNlIGlmIChjb29raWUuc2VjdXJlID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAvLyBzZWN1cmUgcGFyYW1ldGVyIHdhc24ndCBzcGVjaWZpZWQsIGdldCBkZWZhdWx0IGZyb20gY29uZmlnXG4gICAgICAgICAgICAgICAgICBjb29raWVEb21haW4gKz0gXCI7IHNlY3VyZVwiO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICRkb2N1bWVudC5jb29raWUgPSBkZXJpdmVRdWFsaWZpZWRLZXkoa2V5KSArIFwiPVwiICsgZW5jb2RlVVJJQ29tcG9uZW50KHZhbHVlKSArIGV4cGlyeSArIGNvb2tpZVBhdGggKyBjb29raWVEb21haW47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLmVycm9yJywgZS5tZXNzYWdlKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gRGlyZWN0bHkgZ2V0IGEgdmFsdWUgZnJvbSBhIGNvb2tpZVxuICAgICAgICAvLyBFeGFtcGxlIHVzZTogbG9jYWxTdG9yYWdlU2VydmljZS5jb29raWUuZ2V0KCdsaWJyYXJ5Jyk7IC8vIHJldHVybnMgJ2FuZ3VsYXInXG4gICAgICAgIHZhciBnZXRGcm9tQ29va2llcyA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0Nvb2tpZXMpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5lcnJvcicsICdDT09LSUVTX05PVF9TVVBQT1JURUQnKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB2YXIgY29va2llcyA9ICRkb2N1bWVudC5jb29raWUgJiYgJGRvY3VtZW50LmNvb2tpZS5zcGxpdCgnOycpIHx8IFtdO1xuICAgICAgICAgIGZvcih2YXIgaT0wOyBpIDwgY29va2llcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHRoaXNDb29raWUgPSBjb29raWVzW2ldO1xuICAgICAgICAgICAgd2hpbGUgKHRoaXNDb29raWUuY2hhckF0KDApID09PSAnICcpIHtcbiAgICAgICAgICAgICAgdGhpc0Nvb2tpZSA9IHRoaXNDb29raWUuc3Vic3RyaW5nKDEsdGhpc0Nvb2tpZS5sZW5ndGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXNDb29raWUuaW5kZXhPZihkZXJpdmVRdWFsaWZpZWRLZXkoa2V5KSArICc9JykgPT09IDApIHtcbiAgICAgICAgICAgICAgdmFyIHN0b3JlZFZhbHVlcyA9IGRlY29kZVVSSUNvbXBvbmVudCh0aGlzQ29va2llLnN1YnN0cmluZyhwcmVmaXgubGVuZ3RoICsga2V5Lmxlbmd0aCArIDEsIHRoaXNDb29raWUubGVuZ3RoKSk7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgdmFyIHBhcnNlZFZhbHVlID0gSlNPTi5wYXJzZShzdG9yZWRWYWx1ZXMpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0eXBlb2YocGFyc2VkVmFsdWUpID09PSAnbnVtYmVyJyA/IHN0b3JlZFZhbHVlcyA6IHBhcnNlZFZhbHVlO1xuICAgICAgICAgICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RvcmVkVmFsdWVzO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciByZW1vdmVGcm9tQ29va2llcyA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICBhZGRUb0Nvb2tpZXMoa2V5LG51bGwpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciBjbGVhckFsbEZyb21Db29raWVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciB0aGlzQ29va2llID0gbnVsbDtcbiAgICAgICAgICB2YXIgcHJlZml4TGVuZ3RoID0gcHJlZml4Lmxlbmd0aDtcbiAgICAgICAgICB2YXIgY29va2llcyA9ICRkb2N1bWVudC5jb29raWUuc3BsaXQoJzsnKTtcbiAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgY29va2llcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpc0Nvb2tpZSA9IGNvb2tpZXNbaV07XG5cbiAgICAgICAgICAgIHdoaWxlICh0aGlzQ29va2llLmNoYXJBdCgwKSA9PT0gJyAnKSB7XG4gICAgICAgICAgICAgIHRoaXNDb29raWUgPSB0aGlzQ29va2llLnN1YnN0cmluZygxLCB0aGlzQ29va2llLmxlbmd0aCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBrZXkgPSB0aGlzQ29va2llLnN1YnN0cmluZyhwcmVmaXhMZW5ndGgsIHRoaXNDb29raWUuaW5kZXhPZignPScpKTtcbiAgICAgICAgICAgIHJlbW92ZUZyb21Db29raWVzKGtleSk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHZhciBnZXRTdG9yYWdlVHlwZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBzdG9yYWdlVHlwZTtcbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgc2V0U3RvcmFnZVR5cGUgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgICAgICAgaWYgKHR5cGUgJiYgc3RvcmFnZVR5cGUgIT09IHR5cGUpIHtcbiAgICAgICAgICAgIHN0b3JhZ2VUeXBlID0gdHlwZTtcbiAgICAgICAgICAgIGJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSA9IGNoZWNrU3VwcG9ydCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIEFkZCBhIGxpc3RlbmVyIG9uIHNjb3BlIHZhcmlhYmxlIHRvIHNhdmUgaXRzIGNoYW5nZXMgdG8gbG9jYWwgc3RvcmFnZVxuICAgICAgICAvLyBSZXR1cm4gYSBmdW5jdGlvbiB3aGljaCB3aGVuIGNhbGxlZCBjYW5jZWxzIGJpbmRpbmdcbiAgICAgICAgdmFyIGJpbmRUb1Njb3BlID0gZnVuY3Rpb24oc2NvcGUsIGtleSwgZGVmLCBsc0tleSwgdHlwZSkge1xuICAgICAgICAgIGxzS2V5ID0gbHNLZXkgfHwga2V5O1xuICAgICAgICAgIHZhciB2YWx1ZSA9IGdldEZyb21Mb2NhbFN0b3JhZ2UobHNLZXksIHR5cGUpO1xuXG4gICAgICAgICAgaWYgKHZhbHVlID09PSBudWxsICYmIGlzRGVmaW5lZChkZWYpKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGRlZjtcbiAgICAgICAgICB9IGVsc2UgaWYgKGlzT2JqZWN0KHZhbHVlKSAmJiBpc09iamVjdChkZWYpKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGV4dGVuZCh2YWx1ZSwgZGVmKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAkcGFyc2Uoa2V5KS5hc3NpZ24oc2NvcGUsIHZhbHVlKTtcblxuICAgICAgICAgIHJldHVybiBzY29wZS4kd2F0Y2goa2V5LCBmdW5jdGlvbihuZXdWYWwpIHtcbiAgICAgICAgICAgIGFkZFRvTG9jYWxTdG9yYWdlKGxzS2V5LCBuZXdWYWwsIHR5cGUpO1xuICAgICAgICAgIH0sIGlzT2JqZWN0KHNjb3BlW2tleV0pKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBBZGQgbGlzdGVuZXIgdG8gbG9jYWwgc3RvcmFnZSwgZm9yIHVwZGF0ZSBjYWxsYmFja3MuXG4gICAgICAgIGlmIChicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgICAgIGlmICgkd2luZG93LmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICAkd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJzdG9yYWdlXCIsIGhhbmRsZVN0b3JhZ2VDaGFuZ2VDYWxsYmFjaywgZmFsc2UpO1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJG9uKCckZGVzdHJveScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAkd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJzdG9yYWdlXCIsIGhhbmRsZVN0b3JhZ2VDaGFuZ2VDYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYoJHdpbmRvdy5hdHRhY2hFdmVudCl7XG4gICAgICAgICAgICAgICAgLy8gYXR0YWNoRXZlbnQgYW5kIGRldGFjaEV2ZW50IGFyZSBwcm9wcmlldGFyeSB0byBJRSB2Ni0xMFxuICAgICAgICAgICAgICAgICR3aW5kb3cuYXR0YWNoRXZlbnQoXCJvbnN0b3JhZ2VcIiwgaGFuZGxlU3RvcmFnZUNoYW5nZUNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRvbignJGRlc3Ryb3knLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgJHdpbmRvdy5kZXRhY2hFdmVudChcIm9uc3RvcmFnZVwiLCBoYW5kbGVTdG9yYWdlQ2hhbmdlQ2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FsbGJhY2sgaGFuZGxlciBmb3Igc3RvcmFnZSBjaGFuZ2VkLlxuICAgICAgICBmdW5jdGlvbiBoYW5kbGVTdG9yYWdlQ2hhbmdlQ2FsbGJhY2soZSkge1xuICAgICAgICAgICAgaWYgKCFlKSB7IGUgPSAkd2luZG93LmV2ZW50OyB9XG4gICAgICAgICAgICBpZiAobm90aWZ5LnNldEl0ZW0pIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNTdHJpbmcoZS5rZXkpICYmIGlzS2V5UHJlZml4T3VycyhlLmtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGtleSA9IHVuZGVyaXZlUXVhbGlmaWVkS2V5KGUua2V5KTtcbiAgICAgICAgICAgICAgICAgICAgLy8gVXNlIHRpbWVvdXQsIHRvIGF2b2lkIHVzaW5nICRyb290U2NvcGUuJGFwcGx5LlxuICAgICAgICAgICAgICAgICAgICAkdGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24uY2hhbmdlZCcsIHsga2V5OiBrZXksIG5ld3ZhbHVlOiBlLm5ld1ZhbHVlLCBzdG9yYWdlVHlwZTogc2VsZi5zdG9yYWdlVHlwZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmV0dXJuIGxvY2FsU3RvcmFnZVNlcnZpY2UubGVuZ3RoXG4gICAgICAgIC8vIGlnbm9yZSBrZXlzIHRoYXQgbm90IG93bmVkXG4gICAgICAgIHZhciBsZW5ndGhPZkxvY2FsU3RvcmFnZSA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAgICAgICBzZXRTdG9yYWdlVHlwZSh0eXBlKTtcblxuICAgICAgICAgIHZhciBjb3VudCA9IDA7XG4gICAgICAgICAgdmFyIHN0b3JhZ2UgPSAkd2luZG93W3N0b3JhZ2VUeXBlXTtcbiAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgc3RvcmFnZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYoc3RvcmFnZS5rZXkoaSkuaW5kZXhPZihwcmVmaXgpID09PSAwICkge1xuICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gY291bnQ7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBpc1N1cHBvcnRlZDogYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlLFxuICAgICAgICAgIGdldFN0b3JhZ2VUeXBlOiBnZXRTdG9yYWdlVHlwZSxcbiAgICAgICAgICBzZXRTdG9yYWdlVHlwZTogc2V0U3RvcmFnZVR5cGUsXG4gICAgICAgICAgc2V0OiBhZGRUb0xvY2FsU3RvcmFnZSxcbiAgICAgICAgICBhZGQ6IGFkZFRvTG9jYWxTdG9yYWdlLCAvL0RFUFJFQ0FURURcbiAgICAgICAgICBnZXQ6IGdldEZyb21Mb2NhbFN0b3JhZ2UsXG4gICAgICAgICAga2V5czogZ2V0S2V5c0ZvckxvY2FsU3RvcmFnZSxcbiAgICAgICAgICByZW1vdmU6IHJlbW92ZUZyb21Mb2NhbFN0b3JhZ2UsXG4gICAgICAgICAgY2xlYXJBbGw6IGNsZWFyQWxsRnJvbUxvY2FsU3RvcmFnZSxcbiAgICAgICAgICBiaW5kOiBiaW5kVG9TY29wZSxcbiAgICAgICAgICBkZXJpdmVLZXk6IGRlcml2ZVF1YWxpZmllZEtleSxcbiAgICAgICAgICB1bmRlcml2ZUtleTogdW5kZXJpdmVRdWFsaWZpZWRLZXksXG4gICAgICAgICAgbGVuZ3RoOiBsZW5ndGhPZkxvY2FsU3RvcmFnZSxcbiAgICAgICAgICBkZWZhdWx0VG9Db29raWU6IHRoaXMuZGVmYXVsdFRvQ29va2llLFxuICAgICAgICAgIGNvb2tpZToge1xuICAgICAgICAgICAgaXNTdXBwb3J0ZWQ6IGJyb3dzZXJTdXBwb3J0c0Nvb2tpZXMsXG4gICAgICAgICAgICBzZXQ6IGFkZFRvQ29va2llcyxcbiAgICAgICAgICAgIGFkZDogYWRkVG9Db29raWVzLCAvL0RFUFJFQ0FURURcbiAgICAgICAgICAgIGdldDogZ2V0RnJvbUNvb2tpZXMsXG4gICAgICAgICAgICByZW1vdmU6IHJlbW92ZUZyb21Db29raWVzLFxuICAgICAgICAgICAgY2xlYXJBbGw6IGNsZWFyQWxsRnJvbUNvb2tpZXNcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XTtcbiAgfSk7XG59KSh3aW5kb3csIHdpbmRvdy5hbmd1bGFyKTsiLCIoZnVuY3Rpb24oKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYW5ndWxhci1tYXJxdWVlJywgW10pXG5cdFx0LmRpcmVjdGl2ZSgnYW5ndWxhck1hcnF1ZWUnLCBhbmd1bGFyTWFycXVlZSk7XG5cblx0ZnVuY3Rpb24gYW5ndWxhck1hcnF1ZWUoJHRpbWVvdXQpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzdHJpY3Q6ICdBJyxcblx0XHRcdHNjb3BlOiB0cnVlLFxuXHRcdFx0Y29tcGlsZTogZnVuY3Rpb24odEVsZW1lbnQsIHRBdHRycykge1xuXHRcdFx0XHRpZiAodEVsZW1lbnQuY2hpbGRyZW4oKS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHR0RWxlbWVudC5hcHBlbmQoJzxkaXY+JyArIHRFbGVtZW50LnRleHQoKSArICc8L2Rpdj4nKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgY29udGVudCA9IHRFbGVtZW50LmNoaWxkcmVuKCk7XG4gICAgICBcdHZhciAkZWxlbWVudCA9ICQodEVsZW1lbnQpO1xuXHRcdFx0XHQkKHRFbGVtZW50KS5lbXB0eSgpO1xuXHRcdFx0XHR0RWxlbWVudC5hcHBlbmQoJzxkaXYgY2xhc3M9XCJhbmd1bGFyLW1hcnF1ZWVcIiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+JyArIGNvbnRlbnQuY2xvbmUoKVswXS5vdXRlckhUTUwgKyAnPC9kaXY+Jyk7XG4gICAgICAgIHZhciAkaXRlbSA9ICRlbGVtZW50LmZpbmQoJy5hbmd1bGFyLW1hcnF1ZWUnKTtcbiAgICAgICAgJGl0ZW0uY2xvbmUoKS5jc3MoJ2Rpc3BsYXknLCdub25lJykuYXBwZW5kVG8oJGVsZW1lbnQpO1xuXHRcdFx0XHQkZWxlbWVudC53cmFwSW5uZXIoJzxkaXYgc3R5bGU9XCJ3aWR0aDoxMDAwMDBweFwiIGNsYXNzPVwiYW5ndWxhci1tYXJxdWVlLXdyYXBwZXJcIj48L2Rpdj4nKTtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0cG9zdDogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHJzKSB7XG5cdFx0XHRcdFx0XHRcdC8vZGlyZWN0aW9uLCBkdXJhdGlvbixcblx0XHRcdFx0XHRcdFx0dmFyICRlbGVtZW50ID0gJChlbGVtZW50KTtcblx0XHRcdFx0XHRcdFx0dmFyICRpdGVtID0gJGVsZW1lbnQuZmluZCgnLmFuZ3VsYXItbWFycXVlZTpmaXJzdCcpO1xuXHRcdFx0XHRcdFx0XHR2YXIgJG1hcnF1ZWUgPSAkZWxlbWVudC5maW5kKCcuYW5ndWxhci1tYXJxdWVlLXdyYXBwZXInKTtcblx0XHRcdFx0XHRcdFx0dmFyICRjbG9uZUl0ZW0gPSAkZWxlbWVudC5maW5kKCcuYW5ndWxhci1tYXJxdWVlOmxhc3QnKTtcblx0XHRcdFx0XHRcdFx0dmFyIGR1cGxpY2F0ZWQgPSBmYWxzZTtcblxuXHRcdFx0XHRcdFx0XHR2YXIgY29udGFpbmVyV2lkdGggPSBwYXJzZUludCgkZWxlbWVudC53aWR0aCgpKTtcblx0XHRcdFx0XHRcdFx0dmFyIGl0ZW1XaWR0aCA9IHBhcnNlSW50KCRpdGVtLndpZHRoKCkpO1xuXHRcdFx0XHRcdFx0XHR2YXIgZGVmYXVsdE9mZnNldCA9IDIwO1xuXHRcdFx0XHRcdFx0XHR2YXIgZHVyYXRpb24gPSAzMDAwO1xuXHRcdFx0XHRcdFx0XHR2YXIgc2Nyb2xsID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdHZhciBhbmltYXRpb25Dc3NOYW1lID0gJyc7XG5cblx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gY2FsY3VsYXRlV2lkdGhBbmRIZWlnaHQoKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29udGFpbmVyV2lkdGggPSBwYXJzZUludCgkZWxlbWVudC53aWR0aCgpKTtcblx0XHRcdFx0XHRcdFx0XHRpdGVtV2lkdGggPSBwYXJzZUludCgkaXRlbS53aWR0aCgpKTtcblx0XHRcdFx0XHRcdFx0XHRpZiAoaXRlbVdpZHRoID4gY29udGFpbmVyV2lkdGgpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGR1cGxpY2F0ZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRkdXBsaWNhdGVkID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdFx0aWYgKGR1cGxpY2F0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHQkY2xvbmVJdGVtLnNob3coKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0JGNsb25lSXRlbS5oaWRlKCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdFx0JGVsZW1lbnQuaGVpZ2h0KCRpdGVtLmhlaWdodCgpKTtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdGZ1bmN0aW9uIF9vYmpUb1N0cmluZyhvYmopIHtcblx0XHRcdFx0XHRcdFx0XHR2YXIgdGFianNvbiA9IFtdO1xuXHRcdFx0XHRcdFx0XHRcdGZvciAodmFyIHAgaW4gb2JqKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGlmIChvYmouaGFzT3duUHJvcGVydHkocCkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHRhYmpzb24ucHVzaChwICsgJzonICsgb2JqW3BdKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR0YWJqc29uLnB1c2goKTtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gJ3snICsgdGFianNvbi5qb2luKCcsJykgKyAnfSc7XG5cdFx0XHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gY2FsY3VsYXRlQW5pbWF0aW9uRHVyYXRpb24obmV3RHVyYXRpb24pIHtcblx0XHRcdFx0XHRcdFx0XHR2YXIgcmVzdWx0ID0gKGl0ZW1XaWR0aCArIGNvbnRhaW5lcldpZHRoKSAvIGNvbnRhaW5lcldpZHRoICogbmV3RHVyYXRpb24gLyAxMDAwO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChkdXBsaWNhdGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXN1bHQgPSByZXN1bHQgLyAyO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gZ2V0QW5pbWF0aW9uUHJlZml4KCkge1xuXHRcdFx0XHRcdFx0XHRcdHZhciBlbG0gPSBkb2N1bWVudC5ib2R5IHx8IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0XHRcdFx0XHRcdHZhciBkb21QcmVmaXhlcyA9IFsnd2Via2l0JywgJ21veicsJ08nLCdtcycsJ0todG1sJ107XG5cblx0XHRcdFx0XHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRvbVByZWZpeGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoZWxtLnN0eWxlW2RvbVByZWZpeGVzW2ldICsgJ0FuaW1hdGlvbk5hbWUnXSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHZhciBwcmVmaXggPSBkb21QcmVmaXhlc1tpXS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gcHJlZml4O1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdGZ1bmN0aW9uIGNyZWF0ZUtleWZyYW1lKG51bWJlcikge1xuXHRcdFx0XHRcdFx0XHRcdHZhciBwcmVmaXggPSBnZXRBbmltYXRpb25QcmVmaXgoKTtcblxuXHRcdFx0XHRcdFx0XHRcdHZhciBtYXJnaW4gPSBpdGVtV2lkdGg7XG5cdFx0XHRcdFx0XHRcdFx0Ly8gaWYgKGR1cGxpY2F0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHQvLyBcdG1hcmdpbiA9IGl0ZW1XaWR0aFxuXHRcdFx0XHRcdFx0XHRcdC8vIH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0Ly8gXHRtYXJnaW4gPSBpdGVtV2lkdGggKyBjb250YWluZXJXaWR0aDtcblx0XHRcdFx0XHRcdFx0XHQvLyB9XG5cdFx0XHRcdFx0XHRcdFx0dmFyIGtleWZyYW1lU3RyaW5nID0gJ0AtJyArIHByZWZpeCArICcta2V5ZnJhbWVzICcgKyAnc2ltcGxlTWFycXVlZScgKyBudW1iZXI7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIGNzcyA9IHtcblx0XHRcdFx0XHRcdFx0XHRcdCdtYXJnaW4tbGVmdCc6IC0gKG1hcmdpbikgKydweCdcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0dmFyIGtleWZyYW1lQ3NzID0ga2V5ZnJhbWVTdHJpbmcgKyAneyAxMDAlJyArIF9vYmpUb1N0cmluZyhjc3MpICsgJ30nO1xuXHRcdFx0XHRcdFx0XHRcdHZhciAkc3R5bGVzID0gJCgnc3R5bGUnKTtcblxuXHRcdFx0XHRcdFx0XHRcdC8vTm93IGFkZCB0aGUga2V5ZnJhbWUgYW5pbWF0aW9uIHRvIHRoZSBoZWFkXG5cdFx0XHRcdFx0XHRcdFx0aWYgKCRzdHlsZXMubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdC8vQnVnIGZpeGVkIGZvciBqUXVlcnkgMS4zLnggLSBJbnN0ZWFkIG9mIHVzaW5nIC5sYXN0KCksIHVzZSBmb2xsb3dpbmdcblx0XHRcdFx0XHRcdFx0XHRcdFx0JHN0eWxlcy5maWx0ZXIoXCI6bGFzdFwiKS5hcHBlbmQoa2V5ZnJhbWVDc3MpO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdCQoJ2hlYWQnKS5hcHBlbmQoJzxzdHlsZT4nICsga2V5ZnJhbWVDc3MgKyAnPC9zdHlsZT4nKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRmdW5jdGlvbiBzdG9wQW5pbWF0aW9uKCkge1xuXHRcdFx0XHRcdFx0XHRcdCRtYXJxdWVlLmNzcygnbWFyZ2luLWxlZnQnLDApO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChhbmltYXRpb25Dc3NOYW1lICE9ICcnKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQkbWFycXVlZS5jc3MoYW5pbWF0aW9uQ3NzTmFtZSwgJycpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHR9XG5cblxuXHRcdFx0XHRcdFx0XHRmdW5jdGlvbiBjcmVhdGVBbmltYXRpb25Dc3MobnVtYmVyKSB7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIHRpbWUgPSBjYWxjdWxhdGVBbmltYXRpb25EdXJhdGlvbihkdXJhdGlvbik7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIHByZWZpeCA9IGdldEFuaW1hdGlvblByZWZpeCgpO1xuXHRcdFx0XHRcdFx0XHRcdGFuaW1hdGlvbkNzc05hbWUgPSAnLScgKyBwcmVmaXggKyctYW5pbWF0aW9uJztcblx0XHRcdFx0XHRcdFx0XHR2YXIgY3NzVmFsdWUgPSAnc2ltcGxlTWFycXVlZScgKyBudW1iZXIgKyAnICcgKyB0aW1lICsgJ3MgMHMgbGluZWFyIGluZmluaXRlJztcblx0XHRcdFx0XHRcdFx0XHQkbWFycXVlZS5jc3MoYW5pbWF0aW9uQ3NzTmFtZSwgY3NzVmFsdWUpO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChkdXBsaWNhdGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQkbWFycXVlZS5jc3MoJ21hcmdpbi1sZWZ0JywgMCk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBtYXJnaW4gPSBjb250YWluZXJXaWR0aCArIGRlZmF1bHRPZmZzZXQ7XG5cdFx0XHRcdFx0XHRcdFx0XHQkbWFycXVlZS5jc3MoJ21hcmdpbi1sZWZ0JywgbWFyZ2luKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRmdW5jdGlvbiBhbmltYXRlKCkge1xuXHRcdFx0XHRcdFx0XHRcdC8vY3JlYXRlIGNzcyBzdHlsZVxuXHRcdFx0XHRcdFx0XHRcdC8vY3JlYXRlIGtleWZyYW1lXG5cdFx0XHRcdFx0XHRcdFx0Y2FsY3VsYXRlV2lkdGhBbmRIZWlnaHQoKTtcblx0XHRcdFx0XHRcdFx0XHR2YXIgbnVtYmVyID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwMCk7XG5cdFx0XHRcdFx0XHRcdFx0Y3JlYXRlS2V5ZnJhbWUobnVtYmVyKTtcblx0XHRcdFx0XHRcdFx0XHRjcmVhdGVBbmltYXRpb25Dc3MobnVtYmVyKTtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdHNjb3BlLiR3YXRjaChhdHRycy5zY3JvbGwsIGZ1bmN0aW9uKHNjcm9sbEF0dHJWYWx1ZSkge1xuXHRcdFx0XHRcdFx0XHRcdHNjcm9sbCA9IHNjcm9sbEF0dHJWYWx1ZTtcblx0XHRcdFx0XHRcdFx0XHRyZWNhbGN1bGF0ZU1hcnF1ZWUoKTtcblx0XHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gcmVjYWxjdWxhdGVNYXJxdWVlKCkge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChzY3JvbGwpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGFuaW1hdGUoKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0c3RvcEFuaW1hdGlvbigpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdHZhciB0aW1lcjtcblx0XHRcdFx0XHRcdFx0c2NvcGUuJG9uKCdyZWNhbGN1bGF0ZU1hcnF1ZWUnLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKCdyZWNlaXZlIHJlY2FsY3VsYXRlTWFycXVlZSBldmVudCcpO1xuXHRcdFx0XHRcdFx0XHRcdGlmICh0aW1lcikge1xuXHRcdFx0XHRcdFx0XHRcdFx0JHRpbWVvdXQuY2FuY2VsKHRpbWVyKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0dGltZXIgPSAkdGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJlY2FsY3VsYXRlTWFycXVlZSgpO1xuXHRcdFx0XHRcdFx0XHRcdH0sIDUwMCk7XG5cblx0XHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdFx0c2NvcGUuJHdhdGNoKGF0dHJzLmR1cmF0aW9uLCBmdW5jdGlvbihkdXJhdGlvblRleHQpIHtcblx0XHRcdFx0XHRcdFx0XHRkdXJhdGlvbiA9IHBhcnNlSW50KGR1cmF0aW9uVGV4dCk7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHNjcm9sbCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0YW5pbWF0ZSgpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHR9XG5cbn0pKCk7IiwiLyogZ2xvYmFsIFlUICovXG5hbmd1bGFyLm1vZHVsZSgneW91dHViZS1lbWJlZCcsIFtdKVxuLnNlcnZpY2UgKCd5b3V0dWJlRW1iZWRVdGlscycsIFsnJHdpbmRvdycsICckcm9vdFNjb3BlJywgZnVuY3Rpb24gKCR3aW5kb3csICRyb290U2NvcGUpIHtcbiAgICB2YXIgU2VydmljZSA9IHt9XG5cbiAgICAvLyBhZGFwdGVkIGZyb20gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvNTgzMTE5MS8xNjE0OTY3XG4gICAgdmFyIHlvdXR1YmVSZWdleHAgPSAvaHR0cHM/OlxcL1xcLyg/OlswLTlBLVotXStcXC4pPyg/OnlvdXR1XFwuYmVcXC98eW91dHViZSg/Oi1ub2Nvb2tpZSk/XFwuY29tXFxTKlteXFx3XFxzLV0pKFtcXHctXXsxMX0pKD89W15cXHctXXwkKSg/IVs/PSYrJVxcdy4tXSooPzpbJ1wiXVtePD5dKj58PFxcL2E+KSlbPz0mKyVcXHcuLV0qL2lnO1xuICAgIHZhciB0aW1lUmVnZXhwID0gL3Q9KFxcZCspW21zXT8oXFxkKyk/cz8vO1xuXG4gICAgZnVuY3Rpb24gY29udGFpbnMoc3RyLCBzdWJzdHIpIHtcbiAgICAgICAgcmV0dXJuIChzdHIuaW5kZXhPZihzdWJzdHIpID4gLTEpO1xuICAgIH1cblxuICAgIFNlcnZpY2UuZ2V0SWRGcm9tVVJMID0gZnVuY3Rpb24gZ2V0SWRGcm9tVVJMKHVybCkge1xuICAgICAgICB2YXIgaWQgPSB1cmwucmVwbGFjZSh5b3V0dWJlUmVnZXhwLCAnJDEnKTtcblxuICAgICAgICBpZiAoY29udGFpbnMoaWQsICc7JykpIHtcbiAgICAgICAgICAgIHZhciBwaWVjZXMgPSBpZC5zcGxpdCgnOycpO1xuXG4gICAgICAgICAgICBpZiAoY29udGFpbnMocGllY2VzWzFdLCAnJScpKSB7XG4gICAgICAgICAgICAgICAgLy8gbGlua3MgbGlrZSB0aGlzOlxuICAgICAgICAgICAgICAgIC8vIFwiaHR0cDovL3d3dy55b3V0dWJlLmNvbS9hdHRyaWJ1dGlvbl9saW5rP2E9cHhhNmdvSHF6YUEmYW1wO3U9JTJGd2F0Y2glM0Z2JTNEZFBkZ3gzMHc5c1UlMjZmZWF0dXJlJTNEc2hhcmVcIlxuICAgICAgICAgICAgICAgIC8vIGhhdmUgdGhlIHJlYWwgcXVlcnkgc3RyaW5nIFVSSSBlbmNvZGVkIGJlaGluZCBhICc7Jy5cbiAgICAgICAgICAgICAgICAvLyBhdCB0aGlzIHBvaW50LCBgaWQgaXMgJ3B4YTZnb0hxemFBO3U9JTJGd2F0Y2glM0Z2JTNEZFBkZ3gzMHc5c1UlMjZmZWF0dXJlJTNEc2hhcmUnXG4gICAgICAgICAgICAgICAgdmFyIHVyaUNvbXBvbmVudCA9IGRlY29kZVVSSUNvbXBvbmVudChwaWVjZXNbMV0pO1xuICAgICAgICAgICAgICAgIGlkID0gKCdodHRwOi8veW91dHViZS5jb20nICsgdXJpQ29tcG9uZW50KVxuICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoeW91dHViZVJlZ2V4cCwgJyQxJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGh0dHBzOi8vd3d3LnlvdXR1YmUuY29tL3dhdGNoP3Y9VmJORjlYMXdhU2MmYW1wO2ZlYXR1cmU9eW91dHUuYmVcbiAgICAgICAgICAgICAgICAvLyBgaWRgIGxvb2tzIGxpa2UgJ1ZiTkY5WDF3YVNjO2ZlYXR1cmU9eW91dHUuYmUnIGN1cnJlbnRseS5cbiAgICAgICAgICAgICAgICAvLyBzdHJpcCB0aGUgJztmZWF0dXJlPXlvdXR1LmJlJ1xuICAgICAgICAgICAgICAgIGlkID0gcGllY2VzWzBdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGNvbnRhaW5zKGlkLCAnIycpKSB7XG4gICAgICAgICAgICAvLyBpZCBtaWdodCBsb29rIGxpa2UgJzkzTHZUS0ZfalcwI3Q9MSdcbiAgICAgICAgICAgIC8vIGFuZCB3ZSB3YW50ICc5M0x2VEtGX2pXMCdcbiAgICAgICAgICAgIGlkID0gaWQuc3BsaXQoJyMnKVswXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpZDtcbiAgICB9O1xuXG4gICAgU2VydmljZS5nZXRUaW1lRnJvbVVSTCA9IGZ1bmN0aW9uIGdldFRpbWVGcm9tVVJMKHVybCkge1xuICAgICAgICB1cmwgPSB1cmwgfHwgJyc7XG5cbiAgICAgICAgLy8gdD00bTIwc1xuICAgICAgICAvLyByZXR1cm5zIFsndD00bTIwcycsICc0JywgJzIwJ11cbiAgICAgICAgLy8gdD00NnNcbiAgICAgICAgLy8gcmV0dXJucyBbJ3Q9NDZzJywgJzQ2J11cbiAgICAgICAgLy8gdD00NlxuICAgICAgICAvLyByZXR1cm5zIFsndD00NicsICc0NiddXG4gICAgICAgIHZhciB0aW1lcyA9IHVybC5tYXRjaCh0aW1lUmVnZXhwKTtcblxuICAgICAgICBpZiAoIXRpbWVzKSB7XG4gICAgICAgICAgICAvLyB6ZXJvIHNlY29uZHNcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYXNzdW1lIHRoZSBmaXJzdFxuICAgICAgICB2YXIgZnVsbCA9IHRpbWVzWzBdLFxuICAgICAgICAgICAgbWludXRlcyA9IHRpbWVzWzFdLFxuICAgICAgICAgICAgc2Vjb25kcyA9IHRpbWVzWzJdO1xuXG4gICAgICAgIC8vIHQ9NG0yMHNcbiAgICAgICAgaWYgKHR5cGVvZiBzZWNvbmRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgc2Vjb25kcyA9IHBhcnNlSW50KHNlY29uZHMsIDEwKTtcbiAgICAgICAgICAgIG1pbnV0ZXMgPSBwYXJzZUludChtaW51dGVzLCAxMCk7XG5cbiAgICAgICAgLy8gdD00bVxuICAgICAgICB9IGVsc2UgaWYgKGNvbnRhaW5zKGZ1bGwsICdtJykpIHtcbiAgICAgICAgICAgIG1pbnV0ZXMgPSBwYXJzZUludChtaW51dGVzLCAxMCk7XG4gICAgICAgICAgICBzZWNvbmRzID0gMDtcblxuICAgICAgICAvLyB0PTRzXG4gICAgICAgIC8vIHQ9NFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2Vjb25kcyA9IHBhcnNlSW50KG1pbnV0ZXMsIDEwKTtcbiAgICAgICAgICAgIG1pbnV0ZXMgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW4gc2Vjb25kc1xuICAgICAgICByZXR1cm4gc2Vjb25kcyArIChtaW51dGVzICogNjApO1xuICAgIH07XG5cbiAgICBTZXJ2aWNlLnJlYWR5ID0gZmFsc2U7XG5cbiAgICBmdW5jdGlvbiBhcHBseVNlcnZpY2VJc1JlYWR5KCkge1xuICAgICAgICAkcm9vdFNjb3BlLiRhcHBseShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBTZXJ2aWNlLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIElmIHRoZSBsaWJyYXJ5IGlzbid0IGhlcmUgYXQgYWxsLFxuICAgIGlmICh0eXBlb2YgWVQgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgLy8gLi4uZ3JhYiBvbiB0byBnbG9iYWwgY2FsbGJhY2ssIGluIGNhc2UgaXQncyBldmVudHVhbGx5IGxvYWRlZFxuICAgICAgICAkd2luZG93Lm9uWW91VHViZUlmcmFtZUFQSVJlYWR5ID0gYXBwbHlTZXJ2aWNlSXNSZWFkeTtcbiAgICAgICAgY29uc29sZS5sb2coJ1VuYWJsZSB0byBmaW5kIFlvdVR1YmUgaWZyYW1lIGxpYnJhcnkgb24gdGhpcyBwYWdlLicpXG4gICAgfSBlbHNlIGlmIChZVC5sb2FkZWQpIHtcbiAgICAgICAgU2VydmljZS5yZWFkeSA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgWVQucmVhZHkoYXBwbHlTZXJ2aWNlSXNSZWFkeSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFNlcnZpY2U7XG59XSlcbi5kaXJlY3RpdmUoJ3lvdXR1YmVWaWRlbycsIFsnJHdpbmRvdycsICd5b3V0dWJlRW1iZWRVdGlscycsIGZ1bmN0aW9uICgkd2luZG93LCB5b3V0dWJlRW1iZWRVdGlscykge1xuICAgIHZhciB1bmlxSWQgPSAxO1xuXG4gICAgLy8gZnJvbSBZVC5QbGF5ZXJTdGF0ZVxuICAgIHZhciBzdGF0ZU5hbWVzID0ge1xuICAgICAgICAnLTEnOiAndW5zdGFydGVkJyxcbiAgICAgICAgMDogJ2VuZGVkJyxcbiAgICAgICAgMTogJ3BsYXlpbmcnLFxuICAgICAgICAyOiAncGF1c2VkJyxcbiAgICAgICAgMzogJ2J1ZmZlcmluZycsXG4gICAgICAgIDU6ICdxdWV1ZWQnXG4gICAgfTtcblxuICAgIHZhciBldmVudFByZWZpeCA9ICd5b3V0dWJlLnBsYXllci4nO1xuXG4gICAgJHdpbmRvdy5ZVENvbmZpZyA9IHtcbiAgICAgICAgaG9zdDogJ2h0dHBzOi8vd3d3LnlvdXR1YmUuY29tJ1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0VBJyxcbiAgICAgICAgc2NvcGU6IHtcbiAgICAgICAgICAgIHZpZGVvSWQ6ICc9PycsXG4gICAgICAgICAgICB2aWRlb1VybDogJz0/JyxcbiAgICAgICAgICAgIHBsYXllcjogJz0/JyxcbiAgICAgICAgICAgIHBsYXllclZhcnM6ICc9PycsXG4gICAgICAgICAgICBwbGF5ZXJIZWlnaHQ6ICc9PycsXG4gICAgICAgICAgICBwbGF5ZXJXaWR0aDogJz0/J1xuICAgICAgICB9LFxuICAgICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQsIGF0dHJzKSB7XG4gICAgICAgICAgICAvLyBhbGxvd3MgdXMgdG8gJHdhdGNoIGByZWFkeWBcbiAgICAgICAgICAgIHNjb3BlLnV0aWxzID0geW91dHViZUVtYmVkVXRpbHM7XG5cbiAgICAgICAgICAgIC8vIHBsYXllci1pZCBhdHRyID4gaWQgYXR0ciA+IGRpcmVjdGl2ZS1nZW5lcmF0ZWQgSURcbiAgICAgICAgICAgIHZhciBwbGF5ZXJJZCA9IGF0dHJzLnBsYXllcklkIHx8IGVsZW1lbnRbMF0uaWQgfHwgJ3VuaXF1ZS15b3V0dWJlLWVtYmVkLWlkLScgKyB1bmlxSWQrKztcbiAgICAgICAgICAgIGVsZW1lbnRbMF0uaWQgPSBwbGF5ZXJJZDtcblxuICAgICAgICAgICAgLy8gQXR0YWNoIHRvIGVsZW1lbnRcbiAgICAgICAgICAgIHNjb3BlLnBsYXllckhlaWdodCA9IHNjb3BlLnBsYXllckhlaWdodCB8fCAzOTA7XG4gICAgICAgICAgICBzY29wZS5wbGF5ZXJXaWR0aCA9IHNjb3BlLnBsYXllcldpZHRoIHx8IDY0MDtcbiAgICAgICAgICAgIHNjb3BlLnBsYXllclZhcnMgPSBzY29wZS5wbGF5ZXJWYXJzIHx8IHt9O1xuXG4gICAgICAgICAgICAvLyBZVCBjYWxscyBjYWxsYmFja3Mgb3V0c2lkZSBvZiBkaWdlc3QgY3ljbGVcbiAgICAgICAgICAgIGZ1bmN0aW9uIGFwcGx5QnJvYWRjYXN0ICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgc2NvcGUuJGFwcGx5KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NvcGUuJGVtaXQuYXBwbHkoc2NvcGUsIGFyZ3MpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmdW5jdGlvbiBvblBsYXllclN0YXRlQ2hhbmdlIChldmVudCkge1xuICAgICAgICAgICAgICAgIHZhciBzdGF0ZSA9IHN0YXRlTmFtZXNbZXZlbnQuZGF0YV07XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBzdGF0ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgYXBwbHlCcm9hZGNhc3QoZXZlbnRQcmVmaXggKyBzdGF0ZSwgc2NvcGUucGxheWVyLCBldmVudCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNjb3BlLiRhcHBseShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3BlLnBsYXllci5jdXJyZW50U3RhdGUgPSBzdGF0ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZnVuY3Rpb24gb25QbGF5ZXJSZWFkeSAoZXZlbnQpIHtcbiAgICAgICAgICAgICAgICBhcHBseUJyb2FkY2FzdChldmVudFByZWZpeCArICdyZWFkeScsIHNjb3BlLnBsYXllciwgZXZlbnQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmdW5jdGlvbiBvblBsYXllckVycm9yIChldmVudCkge1xuICAgICAgICAgICAgICAgIGFwcGx5QnJvYWRjYXN0KGV2ZW50UHJlZml4ICsgJ2Vycm9yJywgc2NvcGUucGxheWVyLCBldmVudCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIGNyZWF0ZVBsYXllciAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIHBsYXllclZhcnMgPSBhbmd1bGFyLmNvcHkoc2NvcGUucGxheWVyVmFycyk7XG4gICAgICAgICAgICAgICAgcGxheWVyVmFycy5zdGFydCA9IHBsYXllclZhcnMuc3RhcnQgfHwgc2NvcGUudXJsU3RhcnRUaW1lO1xuICAgICAgICAgICAgICAgIHZhciBwbGF5ZXIgPSBuZXcgWVQuUGxheWVyKHBsYXllcklkLCB7XG4gICAgICAgICAgICAgICAgICAgIGhlaWdodDogc2NvcGUucGxheWVySGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICB3aWR0aDogc2NvcGUucGxheWVyV2lkdGgsXG4gICAgICAgICAgICAgICAgICAgIHZpZGVvSWQ6IHNjb3BlLnZpZGVvSWQsXG4gICAgICAgICAgICAgICAgICAgIHBsYXllclZhcnM6IHBsYXllclZhcnMsXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50czoge1xuICAgICAgICAgICAgICAgICAgICAgICAgb25SZWFkeTogb25QbGF5ZXJSZWFkeSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uU3RhdGVDaGFuZ2U6IG9uUGxheWVyU3RhdGVDaGFuZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkVycm9yOiBvblBsYXllckVycm9yXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIHBsYXllci5pZCA9IHBsYXllcklkO1xuICAgICAgICAgICAgICAgIHJldHVybiBwbGF5ZXI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIGxvYWRQbGF5ZXIgKCkge1xuICAgICAgICAgICAgICAgIGlmIChzY29wZS52aWRlb0lkIHx8IHNjb3BlLnBsYXllclZhcnMubGlzdCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2NvcGUucGxheWVyICYmIHR5cGVvZiBzY29wZS5wbGF5ZXIuZGVzdHJveSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGUucGxheWVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHNjb3BlLnBsYXllciA9IGNyZWF0ZVBsYXllcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciBzdG9wV2F0Y2hpbmdSZWFkeSA9IHNjb3BlLiR3YXRjaChcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzY29wZS51dGlscy5yZWFkeVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2FpdCB1bnRpbCBvbmUgb2YgdGhlbSBpcyBkZWZpbmVkLi4uXG4gICAgICAgICAgICAgICAgICAgICAgICAmJiAodHlwZW9mIHNjb3BlLnZpZGVvVXJsICE9PSAndW5kZWZpbmVkJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfHwgIHR5cGVvZiBzY29wZS52aWRlb0lkICE9PSAndW5kZWZpbmVkJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfHwgIHR5cGVvZiBzY29wZS5wbGF5ZXJWYXJzLmxpc3QgIT09ICd1bmRlZmluZWQnKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIChyZWFkeSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVhZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0b3BXYXRjaGluZ1JlYWR5KCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVSTCB0YWtlcyBmaXJzdCBwcmlvcml0eVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBzY29wZS52aWRlb1VybCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZS4kd2F0Y2goJ3ZpZGVvVXJsJywgZnVuY3Rpb24gKHVybCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZS52aWRlb0lkID0gc2NvcGUudXRpbHMuZ2V0SWRGcm9tVVJMKHVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlLnVybFN0YXJ0VGltZSA9IHNjb3BlLnV0aWxzLmdldFRpbWVGcm9tVVJMKHVybCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9hZFBsYXllcigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGVuLCBhIHZpZGVvIElEXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBzY29wZS52aWRlb0lkICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlLiR3YXRjaCgndmlkZW9JZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGUudXJsU3RhcnRUaW1lID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9hZFBsYXllcigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmaW5hbGx5LCBhIGxpc3RcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGUuJHdhdGNoKCdwbGF5ZXJWYXJzLmxpc3QnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlLnVybFN0YXJ0VGltZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvYWRQbGF5ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHNjb3BlLiR3YXRjaENvbGxlY3Rpb24oWydwbGF5ZXJIZWlnaHQnLCAncGxheWVyV2lkdGgnXSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNjb3BlLnBsYXllcikge1xuICAgICAgICAgICAgICAgICAgICBzY29wZS5wbGF5ZXIuc2V0U2l6ZShzY29wZS5wbGF5ZXJXaWR0aCwgc2NvcGUucGxheWVySGVpZ2h0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgc2NvcGUuJG9uKCckZGVzdHJveScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBzY29wZS5wbGF5ZXIgJiYgc2NvcGUucGxheWVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn1dKTtcbiIsInZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZShcIm50dUFwcFwiLCBbJ21nby1tb3VzZXRyYXAnLCAnTG9jYWxTdG9yYWdlTW9kdWxlJywgJ2FuZ3VsYXItbWFycXVlZScsICd5b3V0dWJlLWVtYmVkJywgJ3J6TW9kdWxlJ10pO1xuXG5cbmFwcC5jb25maWcoZnVuY3Rpb24obG9jYWxTdG9yYWdlU2VydmljZVByb3ZpZGVyKSB7XG4gICAgbG9jYWxTdG9yYWdlU2VydmljZVByb3ZpZGVyXG4gICAgICAgIC5zZXRQcmVmaXgoJ05UVS1JQ0FOLVBMQVlFUicpO1xufSk7XG5cbmFwcC5jb250cm9sbGVyKFwiTXVzaWNQbGF5ZXJDb250cm9sbGVyXCIsIGZ1bmN0aW9uKCRzY29wZSwgJHRpbWVvdXQsICRsb2NhdGlvbiwgJGh0dHAsIFBsYXllckZhY3RvcnksIGdvb2dsZVNlcnZpY2UsIGxvY2FsU3RvcmFnZVNlcnZpY2UpIHtcbiAgICAkc2NvcGUuc2VhcmNoaW5nID0gZmFsc2U7XG4gICAgJHNjb3BlLm11c2ljTGlzdHMgPSBbXTtcbiAgICAkc2NvcGUuc2VhcmNoUXVlcnkgPSBcIlwiO1xuICAgICRzY29wZS5jdXJyZW50WW91dHViZVZpZGVvID0gdW5kZWZpbmVkO1xuICAgICRzY29wZS5pc0Zhdm9yaXRlTW9kZSA9IGZhbHNlO1xuICAgICRzY29wZS5mYXZvcml0ZUxpc3RzID0gW107XG4gICAgJHNjb3BlLmxhYk1vZGUgPSB0cnVlO1xuXG4gICAgLy9icm9hZGNhc3RpbmdcbiAgICAkc2NvcGUuYnJvYWRDYXN0aW5nID0gZmFsc2U7XG4gICAgJHNjb3BlLmJyb2FkQ2FzdCA9IFwiXCI7XG4gICAgJHNjb3BlLmlzYnJvYWRDYXN0TWFycXVlZSA9IGZhbHNlO1xuXG4gICAgLy/mqJnpoYzot5Hppqznh4ggTWFycXVlZVxuICAgICRzY29wZS5kdXJhdGlvbiA9IDQwMDA7XG5cbiAgICBmdW5jdGlvbiBhZGRNYXJxdWVlKG11c2ljTGlzdHMpIHtcbiAgICAgICAgaWYgKG11c2ljTGlzdHMgJiYgbXVzaWNMaXN0cy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgbXVzaWNMaXN0cy5mb3JFYWNoKGZ1bmN0aW9uKG0sIGkpIHtcbiAgICAgICAgICAgICAgICBtLm1hcnF1ZWUgPSB7IHNjcm9sbDogZmFsc2UgfTtcblxuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy95b3V0dWJlXG4gICAgJHNjb3BlLnBsYXllclZhcnMgPSB7XG4gICAgICAgIGNvbnRyb2xzOiAwLFxuICAgICAgICBhdXRvcGxheTogMVxuICAgIH07XG5cblxuXG4gICAgLy8kc2NvcGUucHJpY2VTbGlkZXIgPSAxNTA7XG4gICAgJHNjb3BlLnNsaWRlciA9IHtcbiAgICAgICAgdmFsdWU6IDUwLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBpZDogJ250dS1pZCcsXG4gICAgICAgICAgICBmbG9vcjogMCxcbiAgICAgICAgICAgIGNlaWw6IDEwMCxcbiAgICAgICAgICAgIHNob3dTZWxlY3Rpb25CYXI6IHRydWUsXG4gICAgICAgICAgICBoaWRlUG9pbnRlckxhYmVsczogdHJ1ZSxcbiAgICAgICAgICAgIGhpZGVQb2ludGVyTGFiZWxzOiB0cnVlLFxuICAgICAgICAgICAgaGlkZUxpbWl0TGFiZWxzOiB0cnVlLFxuICAgICAgICAgICAgLy8gc2hvd1NlbGVjdGlvbkJhckZyb21WYWx1ZTogdHJ1ZSxcbiAgICAgICAgICAgIG9uQ2hhbmdlOiBmdW5jdGlvbihpZCwgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnb24gY2hhbmdlICcgKyB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgUGxheWVyRmFjdG9yeS5zZXRWb2x1bWUodmFsdWUpLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgYnJvYWRDYXN0KFwi6Kq/5pW06Z+z6YePOlwiICsgdmFsdWUsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cblxuICAgICRzY29wZS5pbml0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICRzY29wZS5tdXNpY0xpc3RzID0gbG9hZFNlYXJjaCgpO1xuICAgICAgICB2YXIgZmF2b3JpdGVMaXN0cyA9IGxvYWRGYXZvcml0ZSgpO1xuICAgICAgICBpZiAoZmF2b3JpdGVMaXN0cylcbiAgICAgICAgICAgICRzY29wZS5mYXZvcml0ZUxpc3RzID0gZmF2b3JpdGVMaXN0cztcbiAgICAgICAgaWYgKGZhdm9yaXRlTGlzdHMpXG4gICAgICAgICAgICAkc2NvcGUubXVzaWNMaXN0cy5mb3JFYWNoKGZ1bmN0aW9uKG0sIGkpIHtcbiAgICAgICAgICAgICAgICBmYXZvcml0ZUxpc3RzLmZvckVhY2goZnVuY3Rpb24oZiwgaikge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChtLl9pZCA9PSBmLl9pZCkgbS5pc0Zhdm9yaXRlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICBhZGRNYXJxdWVlKCRzY29wZS5tdXNpY0xpc3RzKTtcblxuXG5cbiAgICAgICAgaWYgKCRzY29wZS5sYWJNb2RlKSB7XG4gICAgICAgICAgICAvL+Wvpumpl+WupOaooeW8j1xuICAgICAgICAgICAgLy/oroDlj5bpn7Pph49cbiAgICAgICAgICAgIGJyb2FkQ2FzdChcIldFTENPTUUgVE8gTlRVIElDQU4gTEFCIVwiLCB0cnVlKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgUGxheWVyRmFjdG9yeS5sb2FkVm9sdW1lKCkudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAkc2NvcGUuc2xpZGVyLnZhbHVlID0gZGF0YTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICAgICAgICAgICAgYWxlcnQoXCLoq4vpgKPntZBpY2FuLTVnIHdpZmlcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgfVxuXG5cbiAgICAkc2NvcGUuc3dpdGNoTGFiTW9kZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgJHNjb3BlLmxhYk1vZGUgPSAhJHNjb3BlLmxhYk1vZGU7XG5cbiAgICAgICAgaWYgKCRzY29wZS5sYWJNb2RlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIldFTENPTUUgVE8gTlRVIElDQU4gTEFCIVwiKTtcbiAgICAgICAgICAgIGJyb2FkQ2FzdChcIldFTENPTUUgVE8gTlRVIElDQU4gTEFCIVwiLCB0cnVlKTtcbiAgICAgICAgICAgIC8v5a+m6amX5a6k5qih5byPXG4gICAgICAgICAgICAvL+iugOWPlumfs+mHj1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBQbGF5ZXJGYWN0b3J5LmxvYWRWb2x1bWUoKS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICRzY29wZS5zbGlkZXIudmFsdWUgPSBkYXRhO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICAgICAgICAgICAgICBhbGVydChcIuiri+mAo+e1kGljYW4tNWcgd2lmaVwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgfVxuXG4gICAgJHNjb3BlLnN3aXRjaEZhdm9yaXRlID0gZnVuY3Rpb24oaXNGYXZvcml0ZU1vZGUpIHtcbiAgICAgICAgJHNjb3BlLmlzRmF2b3JpdGVNb2RlID0gaXNGYXZvcml0ZU1vZGU7XG4gICAgICAgIGlmICgkc2NvcGUuaXNGYXZvcml0ZU1vZGUpIHtcbiAgICAgICAgICAgIHZhciBmYXZvcml0ZUxpc3RzID0gbG9hZEZhdm9yaXRlKCk7XG4gICAgICAgICAgICBpZiAoZmF2b3JpdGVMaXN0cyAmJiBmYXZvcml0ZUxpc3RzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgZmF2b3JpdGVMaXN0cy5mb3JFYWNoKGZ1bmN0aW9uKG0sIGkpIHtcbiAgICAgICAgICAgICAgICAgICAgbS5pc1NlbGVjdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAkc2NvcGUuZmF2b3JpdGVMaXN0cyA9IGZhdm9yaXRlTGlzdHM7XG4gICAgICAgICAgICAkc2NvcGUubXVzaWNMaXN0cyA9IGZhdm9yaXRlTGlzdHM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAkc2NvcGUuaW5pdCgpO1xuICAgICAgICB9XG5cbiAgICB9XG5cblxuICAgICRzY29wZS5sYWJQYXVzZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBQbGF5ZXJGYWN0b3J5LnBhdXNlKCkudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICAgICAgICAgIGJyb2FkQ2FzdChcIuWBnOatoumfs+aoglwiLCBmYWxzZSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgICRzY29wZS5sYWJTdG9wID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIFBsYXllckZhY3RvcnkucGxheShcIlwiKS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdGEpO1xuICAgICAgICAgICAgYnJvYWRDYXN0KFwi5pqr5YGc6Z+z5qiCXCIsIGZhbHNlKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgJHNjb3BlLnNlYXJjaCA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG5cbiAgICAgICAgJHNjb3BlLm11c2ljTGlzdHMgPSBbXTtcbiAgICAgICAgJHNjb3BlLnNlYXJjaGluZyA9IHRydWU7XG4gICAgICAgIGdvb2dsZVNlcnZpY2UueW91dHViZVNlYXJjaChxdWVyeSkudGhlbihmdW5jdGlvbihkYXRhKSB7XG5cbiAgICAgICAgICAgIGlmIChkYXRhLml0ZW1zKSB7XG4gICAgICAgICAgICAgICAgZGF0YS5pdGVtcy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGkpIHtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgbXVzaWNDYXJkID0ge307XG4gICAgICAgICAgICAgICAgICAgIG11c2ljQ2FyZC5faWQgPSBpdGVtWydpZCddWyd2aWRlb0lkJ107XG4gICAgICAgICAgICAgICAgICAgIG11c2ljQ2FyZC50aXRsZSA9IGl0ZW1bJ3NuaXBwZXQnXVsndGl0bGUnXTtcbiAgICAgICAgICAgICAgICAgICAgbXVzaWNDYXJkLnVybCA9IFwiaHR0cHM6Ly93d3cueW91dHViZS5jb20vZW1iZWQvXCIgKyBtdXNpY0NhcmQuX2lkO1xuICAgICAgICAgICAgICAgICAgICBtdXNpY0NhcmQuaW1hZ2UgPSBcImh0dHA6Ly9pbWcueW91dHViZS5jb20vdmkvXCIgKyBtdXNpY0NhcmQuX2lkICsgXCIvMC5qcGdcIjtcbiAgICAgICAgICAgICAgICAgICAgbXVzaWNDYXJkLmRlc2NyaXB0aW9uID0gaXRlbVsnc25pcHBldCddWydkZXNjcmlwdGlvbiddO1xuICAgICAgICAgICAgICAgICAgICBtdXNpY0NhcmQuaXNTZWxlY3QgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgbXVzaWNDYXJkLmlzRmF2b3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgJHNjb3BlLm11c2ljTGlzdHMucHVzaChtdXNpY0NhcmQpO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhbGVydChcIuaQnOWwi+mMr+iqpFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICRzY29wZS5zZWFyY2hpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHNhdmVTZWFyY2goJHNjb3BlLm11c2ljTGlzdHMpO1xuICAgICAgICAgICAgYWRkTWFycXVlZSgkc2NvcGUubXVzaWNMaXN0cyk7XG4gICAgICAgIH0pO1xuXG5cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjb252ZXJ0X3RpbWUoZHVyYXRpb24pIHtcbiAgICAgICAgdmFyIGEgPSBkdXJhdGlvbi5tYXRjaCgvXFxkKy9nKTtcblxuICAgICAgICBpZiAoZHVyYXRpb24uaW5kZXhPZignTScpID49IDAgJiYgZHVyYXRpb24uaW5kZXhPZignSCcpID09IC0xICYmIGR1cmF0aW9uLmluZGV4T2YoJ1MnKSA9PSAtMSkge1xuICAgICAgICAgICAgYSA9IFswLCBhWzBdLCAwXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkdXJhdGlvbi5pbmRleE9mKCdIJykgPj0gMCAmJiBkdXJhdGlvbi5pbmRleE9mKCdNJykgPT0gLTEpIHtcbiAgICAgICAgICAgIGEgPSBbYVswXSwgMCwgYVsxXV07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGR1cmF0aW9uLmluZGV4T2YoJ0gnKSA+PSAwICYmIGR1cmF0aW9uLmluZGV4T2YoJ00nKSA9PSAtMSAmJiBkdXJhdGlvbi5pbmRleE9mKCdTJykgPT0gLTEpIHtcbiAgICAgICAgICAgIGEgPSBbYVswXSwgMCwgMF07XG4gICAgICAgIH1cblxuICAgICAgICBkdXJhdGlvbiA9IDA7XG5cbiAgICAgICAgaWYgKGEubGVuZ3RoID09IDMpIHtcbiAgICAgICAgICAgIGR1cmF0aW9uID0gZHVyYXRpb24gKyBwYXJzZUludChhWzBdKSAqIDM2MDA7XG4gICAgICAgICAgICBkdXJhdGlvbiA9IGR1cmF0aW9uICsgcGFyc2VJbnQoYVsxXSkgKiA2MDtcbiAgICAgICAgICAgIGR1cmF0aW9uID0gZHVyYXRpb24gKyBwYXJzZUludChhWzJdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICBkdXJhdGlvbiA9IGR1cmF0aW9uICsgcGFyc2VJbnQoYVswXSkgKiA2MDtcbiAgICAgICAgICAgIGR1cmF0aW9uID0gZHVyYXRpb24gKyBwYXJzZUludChhWzFdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICBkdXJhdGlvbiA9IGR1cmF0aW9uICsgcGFyc2VJbnQoYVswXSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGggPSBNYXRoLmZsb29yKGR1cmF0aW9uIC8gMzYwMCk7XG4gICAgICAgIHZhciBtID0gTWF0aC5mbG9vcihkdXJhdGlvbiAlIDM2MDAgLyA2MCk7XG4gICAgICAgIHZhciBzID0gTWF0aC5mbG9vcihkdXJhdGlvbiAlIDM2MDAgJSA2MCk7XG4gICAgICAgIHJldHVybiAoKGggPiAwID8gaCArIFwiOlwiICsgKG0gPCAxMCA/IFwiMFwiIDogXCJcIikgOiBcIlwiKSArIG0gKyBcIjpcIiArIChzIDwgMTAgPyBcIjBcIiA6IFwiXCIpICsgcyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9hZFNlYXJjaCgpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCLoroDlj5bkuIrmrKHmkJzlsIvni4DmhYsuLlwiKTtcbiAgICAgICAgaWYgKGxvY2FsU3RvcmFnZVNlcnZpY2UuaXNTdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRMb2NhbFN0b3JnZSgnTlRVLUlDQU4tUExBWUVSLVNFQVJDSCcpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzYXZlU2VhcmNoKG11c2ljTGlzdHMpIHtcblxuICAgICAgICBpZiAobG9jYWxTdG9yYWdlU2VydmljZS5pc1N1cHBvcnRlZCkge1xuXG4gICAgICAgICAgICBzZXRMb2NhbFN0b3JnZSgnTlRVLUlDQU4tUExBWUVSLVNFQVJDSCcsIG11c2ljTGlzdHMpXG4gICAgICAgIH1cblxuXG4gICAgfVxuXG5cblxuICAgICRzY29wZS5wbGF5VmlkZW8gPSBmdW5jdGlvbihldmVudCwgbXVzaWNDYXJkKSB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICBjb25zb2xlLmxvZyhtdXNpY0NhcmQpO1xuXG5cbiAgICAgICAgcGxheVZpZGVvSW5QbGF5ZXIobXVzaWNDYXJkLl9pZCk7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBwbGF5VmlkZW9JblBsYXllcihfaWQpIHtcbiAgICAgICAgJHNjb3BlLmN1cnJlbnRZb3V0dWJlVmlkZW8gPSBfaWQ7XG5cbiAgICB9XG5cbiAgICAkc2NvcGUuYWRkVG9NeUZhdm9yaXRlID0gZnVuY3Rpb24oZXZlbnQsIG11c2ljQ2FyZCkge1xuXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICBtdXNpY0NhcmQuaXNGYXZvcml0ZSA9ICFtdXNpY0NhcmQuaXNGYXZvcml0ZTtcblxuICAgICAgICBpZiAobXVzaWNDYXJkLmlzRmF2b3JpdGUpXG4gICAgICAgICAgICAkc2NvcGUuZmF2b3JpdGVMaXN0cy5wdXNoKG11c2ljQ2FyZCk7XG4gICAgICAgIGVsc2Uge1xuXG4gICAgICAgICAgICB2YXIgaWR4ID0gJHNjb3BlLmZhdm9yaXRlTGlzdHMuaW5kZXhPZihtdXNpY0NhcmQpO1xuICAgICAgICAgICAgJHNjb3BlLmZhdm9yaXRlTGlzdHMuc3BsaWNlKGlkeCwgMSk7XG5cbiAgICAgICAgfVxuXG5cblxuICAgICAgICBhZGRNYXJxdWVlKCRzY29wZS5mYXZvcml0ZUxpc3RzKTtcbiAgICAgICAgc2F2ZUZhdm9yaXRlKCRzY29wZS5mYXZvcml0ZUxpc3RzKTtcblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvYWRGYXZvcml0ZSgpIHtcbiAgICAgICAgaWYgKGxvY2FsU3RvcmFnZVNlcnZpY2UuaXNTdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRMb2NhbFN0b3JnZSgnTlRVLUlDQU4tUExBWUVSLUZBVk9SSVRFJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzYXZlRmF2b3JpdGUobXVzaWNMaXN0cykge1xuXG4gICAgICAgIGlmIChsb2NhbFN0b3JhZ2VTZXJ2aWNlLmlzU3VwcG9ydGVkKSB7XG5cbiAgICAgICAgICAgIHNldExvY2FsU3RvcmdlKCdOVFUtSUNBTi1QTEFZRVItRkFWT1JJVEUnLCBtdXNpY0xpc3RzKVxuICAgICAgICB9XG5cblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldExvY2FsU3RvcmdlKGtleSwgdmFsKSB7XG4gICAgICAgIHJldHVybiBsb2NhbFN0b3JhZ2VTZXJ2aWNlLnNldChrZXksIHZhbCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0TG9jYWxTdG9yZ2Uoa2V5KSB7XG4gICAgICAgIHJldHVybiBsb2NhbFN0b3JhZ2VTZXJ2aWNlLmdldChrZXkpO1xuICAgIH1cblxuXG4gICAgJHNjb3BlLmFkZFRvUGxheWVyTGlzdCA9IGZ1bmN0aW9uKGV2ZW50LCBtdXNpY0NhcmQpIHtcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblxuICAgICAgICBQbGF5ZXJGYWN0b3J5LnBsYXkobXVzaWNDYXJkLl9pZCkudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICAgICAgICAgIGJyb2FkQ2FzdChcIuWvpumpl+WupOaSreaUvuetieW+heS4rVwiLCB0cnVlKTtcbiAgICAgICAgfSk7XG5cblxuICAgIH1cblxuXG5cbiAgICAkc2NvcGUuc2VsZWN0TXVzaWNDYXJkID0gZnVuY3Rpb24obXVzaWNDYXJkKSB7XG4gICAgICAgIHZhciB0b2dnbGUgPSB0cnVlO1xuICAgICAgICBpZiAobXVzaWNDYXJkLmlzU2VsZWN0ID09IHRydWUpXG4gICAgICAgICAgICB0b2dnbGUgPSBmYWxzZTtcblxuICAgICAgICBjbGVhblNlbGVjdGVkKCk7XG5cbiAgICAgICAgbXVzaWNDYXJkLmlzU2VsZWN0ID0gdG9nZ2xlO1xuXG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBzYXZlTXlGYXZvcml0ZSgpIHtcbiAgICAgICAgJHNjb3BlLm11c2ljTGlzdHMuZm9yRWFjaChmdW5jdGlvbihtdXNpY0NhcmQsIGkpIHtcbiAgICAgICAgICAgIG11c2ljQ2FyZC5pc1NlbGVjdCA9IGZhbHNlO1xuXG4gICAgICAgIH0pO1xuXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2xlYW5TZWxlY3RlZCgpIHtcbiAgICAgICAgJHNjb3BlLm11c2ljTGlzdHMuZm9yRWFjaChmdW5jdGlvbihtdXNpY0NhcmQsIGkpIHtcbiAgICAgICAgICAgIG11c2ljQ2FyZC5pc1NlbGVjdCA9IGZhbHNlO1xuXG4gICAgICAgIH0pO1xuXG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBicm9hZENhc3QobWVzc2FnZSwgaXNNYXJxdWVlKSB7XG5cbiAgICAgICAgJHNjb3BlLmJyb2FkQ2FzdGluZyA9IHRydWU7XG4gICAgICAgICRzY29wZS5pc2Jyb2FkQ2FzdE1hcnF1ZWUgPSBpc01hcnF1ZWU7XG5cbiAgICAgICAgJHNjb3BlLmJyb2FkQ2FzdCA9IG1lc3NhZ2U7XG4gICAgICAgICR0aW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgJHNjb3BlLmJyb2FkQ2FzdGluZyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAkc2NvcGUuYnJvYWRDYXN0ID0gXCJcIjtcbiAgICAgICAgfSwgMzAwMCk7XG5cbiAgICB9XG5cblxufSk7XG5cbmFwcC5mYWN0b3J5KCdQbGF5ZXJGYWN0b3J5JywgZnVuY3Rpb24oJHEsICRodHRwKSB7XG5cblxuICAgIHZhciBfZmFjdG9yeSA9IHt9O1xuICAgIF9mYWN0b3J5LnBsYXkgPSBmdW5jdGlvbihpZCkge1xuICAgICAgICB2YXIgZGVmZXIgPSAkcS5kZWZlcigpO1xuICAgICAgICAkaHR0cC5nZXQoXCJodHRwOi8vMTQwLjExMi4yNi4yMzY6ODAvbXVzaWM/aWQ9XCIgKyBpZClcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgX2ZhY3RvcnkuZGF0YSA9IHJlc3BvbnNlLmRhdGE7XG4gICAgICAgICAgICAgICAgZGVmZXIucmVzb2x2ZShfZmFjdG9yeS5kYXRhKTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgYWxlcnQoXCLoq4vpgKPntZBOVFVJIENBTiBMQUIgd2lmae+8jOaIluaYr+S8uuacjeWZqOmMr+iqpOOAglwiKTtcbiAgICAgICAgICAgICAgICBkZWZlci5yZWplY3QoX2ZhY3RvcnkuZGF0YSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2U7XG4gICAgfTtcblxuXG4gICAgX2ZhY3RvcnkubG9hZFZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgZGVmZXIgPSAkcS5kZWZlcigpO1xuICAgICAgICAkaHR0cC5nZXQoXCJodHRwOi8vMTQwLjExMi4yNi4yMzY6ODAvZ2V0X3ZvbHVtZVwiKVxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICBfZmFjdG9yeS5kYXRhID0gcmVzcG9uc2UuZGF0YTtcbiAgICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKF9mYWN0b3J5LmRhdGEpO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24ocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICBhbGVydChcIuiri+mAo+e1kE5UVUkgQ0FOIExBQiB3aWZp77yM5oiW5piv5Ly65pyN5Zmo6Yyv6Kqk44CCXCIpO1xuICAgICAgICAgICAgICAgIGRlZmVyLnJlamVjdChfZmFjdG9yeS5kYXRhKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZGVmZXIucHJvbWlzZTtcbiAgICB9O1xuXG4gICAgX2ZhY3Rvcnkuc2V0Vm9sdW1lID0gZnVuY3Rpb24ocmFuZ2UpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gJHEuZGVmZXIoKTtcbiAgICAgICAgJGh0dHAuZ2V0KFwiaHR0cDovLzE0MC4xMTIuMjYuMjM2OjgwL3NldF92b2x1bWU/dm9sdW1lPVwiICsgcmFuZ2UpXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbihyZXNwb25zZSkge1xuICAgICAgICAgICAgICAgIF9mYWN0b3J5LmRhdGEgPSByZXNwb25zZS5kYXRhO1xuICAgICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUoX2ZhY3RvcnkuZGF0YSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbihyZXNwb25zZSkge1xuICAgICAgICAgICAgICAgIGFsZXJ0KFwi6KuL6YCj57WQTlRVSSBDQU4gTEFCIHdpZmnvvIzmiJbmmK/kvLrmnI3lmajpjK/oqqTjgIJcIik7XG4gICAgICAgICAgICAgICAgZGVmZXIucmVqZWN0KF9mYWN0b3J5LmRhdGEpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlO1xuICAgIH07XG4gICAgX2ZhY3RvcnkucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGRlZmVyID0gJHEuZGVmZXIoKTtcbiAgICAgICAgJGh0dHAuZ2V0KFwiaHR0cDovLzE0MC4xMTIuMjYuMjM2OjgwL3BhdXNlX2FuZF9wbGF5XCIpXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbihyZXNwb25zZSkge1xuICAgICAgICAgICAgICAgIF9mYWN0b3J5LmRhdGEgPSByZXNwb25zZS5kYXRhO1xuICAgICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUoX2ZhY3RvcnkuZGF0YSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbihyZXNwb25zZSkge1xuICAgICAgICAgICAgICAgIGFsZXJ0KFwi6KuL6YCj57WQTlRVSSBDQU4gTEFCIHdpZmnvvIzmiJbmmK/kvLrmnI3lmajpjK/oqqTjgIJcIik7XG4gICAgICAgICAgICAgICAgZGVmZXIucmVqZWN0KF9mYWN0b3J5LmRhdGEpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlO1xuICAgIH07XG5cblxuXG5cblxuICAgIHJldHVybiBfZmFjdG9yeTtcbn0pO1xuXG5hcHAuZmFjdG9yeSgnZ29vZ2xlU2VydmljZScsIGZ1bmN0aW9uKCRxLCAkaHR0cCkge1xuXG4gICAgdmFyIF9mYWN0b3J5ID0ge307XG5cblxuICAgIF9mYWN0b3J5LnlvdXR1YmVTZWFyY2ggPSBmdW5jdGlvbihxdWVyeSkge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xuXG4gICAgICAgIGdhcGkuY2xpZW50LmxvYWQoJ3lvdXR1YmUnLCAndjMnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGdhcGkuY2xpZW50LnNldEFwaUtleSgnQUl6YVN5Q1J3TXVHUDUwYU92cnB0eVhSWnR2ZUU1MGZhT0xiOFIwJyk7XG4gICAgICAgICAgICB2YXIgcmVxdWVzdCA9IGdhcGkuY2xpZW50LnlvdXR1YmUuc2VhcmNoLmxpc3Qoe1xuICAgICAgICAgICAgICAgIHBhcnQ6ICdzbmlwcGV0LGlkJyxcbiAgICAgICAgICAgICAgICBxOiBxdWVyeSxcbiAgICAgICAgICAgICAgICB0eXBlOiAndmlkZW8nLFxuICAgICAgICAgICAgICAgIG1heFJlc3VsdHM6IDI0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJlcXVlc3QuZXhlY3V0ZShmdW5jdGlvbihyZXNwb25zZSkge1xuXG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShyZXNwb25zZS5yZXN1bHQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xuICAgIF9mYWN0b3J5LnlvdXR1YmVTZWFyY2hXaXRoQ29udGVudCA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XG5cbiAgICAgICAgZ2FwaS5jbGllbnQubG9hZCgneW91dHViZScsICd2MycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgZ2FwaS5jbGllbnQuc2V0QXBpS2V5KCdBSXphU3lDUndNdUdQNTBhT3ZycHR5WFJadHZlRTUwZmFPTGI4UjAnKTtcbiAgICAgICAgICAgIHZhciByZXF1ZXN0ID0gZ2FwaS5jbGllbnQueW91dHViZS5zZWFyY2gubGlzdCh7XG4gICAgICAgICAgICAgICAgcGFydDogJ3NuaXBwZXQsaWQnLFxuICAgICAgICAgICAgICAgIHE6IHF1ZXJ5LFxuICAgICAgICAgICAgICAgIHR5cGU6ICd2aWRlbycsXG4gICAgICAgICAgICAgICAgbWF4UmVzdWx0czogMjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmVxdWVzdC5leGVjdXRlKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNlYXJjaFJlc3VsdHMgPSB7IGl0ZW1zOiBbXSB9O1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlLnJlc3VsdC5pdGVtcy5mb3JFYWNoKGZ1bmN0aW9uKGRhdGEsIGkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHVybDEgPSBcImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL3lvdXR1YmUvdjMvdmlkZW9zP2lkPVwiICsgZGF0YS5pZC52aWRlb0lkICsgXCIma2V5PUFJemFTeUNSd011R1A1MGFPdnJwdHlYUlp0dmVFNTBmYU9MYjhSMCZwYXJ0PXNuaXBwZXQsY29udGVudERldGFpbHNcIjtcbiAgICAgICAgICAgICAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzeW5jOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdHRVQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiB1cmwxLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXRhLml0ZW1zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZGF0YS5pdGVtc1swXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZhciBvdXRwdXQgPSBnZXRSZXN1bHRzKGRhdGEuaXRlbXNbMF0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWFyY2hSZXN1bHRzLml0ZW1zLnB1c2goZGF0YS5pdGVtc1swXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vICQoJyNyZXN1bHRzJykuYXBwZW5kKG91dHB1dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vIGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UucmVzdWx0KTtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHNlYXJjaFJlc3VsdHMpO1xuXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcblxuXG5cbiAgICByZXR1cm4gX2ZhY3Rvcnk7XG59KTtcblxuYXBwLmRpcmVjdGl2ZSgncHJlc3NFbnRlcicsIGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBmdW5jdGlvbihzY29wZSwgZWxlbWVudCwgYXR0cnMpIHtcbiAgICAgICAgZWxlbWVudC5iaW5kKFwia2V5ZG93biBrZXlwcmVzc1wiLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgaWYgKGV2ZW50LndoaWNoID09PSAxMykge1xuICAgICAgICAgICAgICAgIHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NvcGUuJGV2YWwoYXR0cnMucHJlc3NFbnRlcik7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xufSk7XG4iLCIvKiFcbiAqIE1pekpzIHYxLjAuMCBcbiAqIENvcHlyaWdodCBNaXpUZWNoXG4gKiBMaWNlbnNlZCBNaWtlWmhlbmdcbiAqIGh0dHA6Ly9taWtlLXpoZW5nLmdpdGh1Yi5pby9cbiAqL1xuIFxuLy8gISBqUXVlcnkgdjEuOS4xIHwgKGMpIDIwMDUsIDIwMTIgalF1ZXJ5IEZvdW5kYXRpb24sIEluYy4gfCBqcXVlcnkub3JnL2xpY2Vuc2Vcbi8vQCBzb3VyY2VNYXBwaW5nVVJMPWpxdWVyeS5taW4ubWFwXG4oZnVuY3Rpb24oZSx0KXt2YXIgbixyLGk9dHlwZW9mIHQsbz1lLmRvY3VtZW50LGE9ZS5sb2NhdGlvbixzPWUualF1ZXJ5LHU9ZS4kLGw9e30sYz1bXSxwPVwiMS45LjFcIixmPWMuY29uY2F0LGQ9Yy5wdXNoLGg9Yy5zbGljZSxnPWMuaW5kZXhPZixtPWwudG9TdHJpbmcseT1sLmhhc093blByb3BlcnR5LHY9cC50cmltLGI9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gbmV3IGIuZm4uaW5pdChlLHQscil9LHg9L1srLV0/KD86XFxkKlxcLnwpXFxkKyg/OltlRV1bKy1dP1xcZCt8KS8uc291cmNlLHc9L1xcUysvZyxUPS9eW1xcc1xcdUZFRkZcXHhBMF0rfFtcXHNcXHVGRUZGXFx4QTBdKyQvZyxOPS9eKD86KDxbXFx3XFxXXSs+KVtePl0qfCMoW1xcdy1dKikpJC8sQz0vXjwoXFx3KylcXHMqXFwvPz4oPzo8XFwvXFwxPnwpJC8saz0vXltcXF0sOnt9XFxzXSokLyxFPS8oPzpefDp8LCkoPzpcXHMqXFxbKSsvZyxTPS9cXFxcKD86W1wiXFxcXFxcL2JmbnJ0XXx1W1xcZGEtZkEtRl17NH0pL2csQT0vXCJbXlwiXFxcXFxcclxcbl0qXCJ8dHJ1ZXxmYWxzZXxudWxsfC0/KD86XFxkK1xcLnwpXFxkKyg/OltlRV1bKy1dP1xcZCt8KS9nLGo9L14tbXMtLyxEPS8tKFtcXGRhLXpdKS9naSxMPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIHQudG9VcHBlckNhc2UoKX0sSD1mdW5jdGlvbihlKXsoby5hZGRFdmVudExpc3RlbmVyfHxcImxvYWRcIj09PWUudHlwZXx8XCJjb21wbGV0ZVwiPT09by5yZWFkeVN0YXRlKSYmKHEoKSxiLnJlYWR5KCkpfSxxPWZ1bmN0aW9uKCl7by5hZGRFdmVudExpc3RlbmVyPyhvLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsSCwhMSksZS5yZW1vdmVFdmVudExpc3RlbmVyKFwibG9hZFwiLEgsITEpKTooby5kZXRhY2hFdmVudChcIm9ucmVhZHlzdGF0ZWNoYW5nZVwiLEgpLGUuZGV0YWNoRXZlbnQoXCJvbmxvYWRcIixIKSl9O2IuZm49Yi5wcm90b3R5cGU9e2pxdWVyeTpwLGNvbnN0cnVjdG9yOmIsaW5pdDpmdW5jdGlvbihlLG4scil7dmFyIGksYTtpZighZSlyZXR1cm4gdGhpcztpZihcInN0cmluZ1wiPT10eXBlb2YgZSl7aWYoaT1cIjxcIj09PWUuY2hhckF0KDApJiZcIj5cIj09PWUuY2hhckF0KGUubGVuZ3RoLTEpJiZlLmxlbmd0aD49Mz9bbnVsbCxlLG51bGxdOk4uZXhlYyhlKSwhaXx8IWlbMV0mJm4pcmV0dXJuIW58fG4uanF1ZXJ5PyhufHxyKS5maW5kKGUpOnRoaXMuY29uc3RydWN0b3IobikuZmluZChlKTtpZihpWzFdKXtpZihuPW4gaW5zdGFuY2VvZiBiP25bMF06bixiLm1lcmdlKHRoaXMsYi5wYXJzZUhUTUwoaVsxXSxuJiZuLm5vZGVUeXBlP24ub3duZXJEb2N1bWVudHx8bjpvLCEwKSksQy50ZXN0KGlbMV0pJiZiLmlzUGxhaW5PYmplY3QobikpZm9yKGkgaW4gbiliLmlzRnVuY3Rpb24odGhpc1tpXSk/dGhpc1tpXShuW2ldKTp0aGlzLmF0dHIoaSxuW2ldKTtyZXR1cm4gdGhpc31pZihhPW8uZ2V0RWxlbWVudEJ5SWQoaVsyXSksYSYmYS5wYXJlbnROb2RlKXtpZihhLmlkIT09aVsyXSlyZXR1cm4gci5maW5kKGUpO3RoaXMubGVuZ3RoPTEsdGhpc1swXT1hfXJldHVybiB0aGlzLmNvbnRleHQ9byx0aGlzLnNlbGVjdG9yPWUsdGhpc31yZXR1cm4gZS5ub2RlVHlwZT8odGhpcy5jb250ZXh0PXRoaXNbMF09ZSx0aGlzLmxlbmd0aD0xLHRoaXMpOmIuaXNGdW5jdGlvbihlKT9yLnJlYWR5KGUpOihlLnNlbGVjdG9yIT09dCYmKHRoaXMuc2VsZWN0b3I9ZS5zZWxlY3Rvcix0aGlzLmNvbnRleHQ9ZS5jb250ZXh0KSxiLm1ha2VBcnJheShlLHRoaXMpKX0sc2VsZWN0b3I6XCJcIixsZW5ndGg6MCxzaXplOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMubGVuZ3RofSx0b0FycmF5OmZ1bmN0aW9uKCl7cmV0dXJuIGguY2FsbCh0aGlzKX0sZ2V0OmZ1bmN0aW9uKGUpe3JldHVybiBudWxsPT1lP3RoaXMudG9BcnJheSgpOjA+ZT90aGlzW3RoaXMubGVuZ3RoK2VdOnRoaXNbZV19LHB1c2hTdGFjazpmdW5jdGlvbihlKXt2YXIgdD1iLm1lcmdlKHRoaXMuY29uc3RydWN0b3IoKSxlKTtyZXR1cm4gdC5wcmV2T2JqZWN0PXRoaXMsdC5jb250ZXh0PXRoaXMuY29udGV4dCx0fSxlYWNoOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIGIuZWFjaCh0aGlzLGUsdCl9LHJlYWR5OmZ1bmN0aW9uKGUpe3JldHVybiBiLnJlYWR5LnByb21pc2UoKS5kb25lKGUpLHRoaXN9LHNsaWNlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMucHVzaFN0YWNrKGguYXBwbHkodGhpcyxhcmd1bWVudHMpKX0sZmlyc3Q6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5lcSgwKX0sbGFzdDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmVxKC0xKX0sZXE6ZnVuY3Rpb24oZSl7dmFyIHQ9dGhpcy5sZW5ndGgsbj0rZSsoMD5lP3Q6MCk7cmV0dXJuIHRoaXMucHVzaFN0YWNrKG4+PTAmJnQ+bj9bdGhpc1tuXV06W10pfSxtYXA6ZnVuY3Rpb24oZSl7cmV0dXJuIHRoaXMucHVzaFN0YWNrKGIubWFwKHRoaXMsZnVuY3Rpb24odCxuKXtyZXR1cm4gZS5jYWxsKHQsbix0KX0pKX0sZW5kOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMucHJldk9iamVjdHx8dGhpcy5jb25zdHJ1Y3RvcihudWxsKX0scHVzaDpkLHNvcnQ6W10uc29ydCxzcGxpY2U6W10uc3BsaWNlfSxiLmZuLmluaXQucHJvdG90eXBlPWIuZm4sYi5leHRlbmQ9Yi5mbi5leHRlbmQ9ZnVuY3Rpb24oKXt2YXIgZSxuLHIsaSxvLGEscz1hcmd1bWVudHNbMF18fHt9LHU9MSxsPWFyZ3VtZW50cy5sZW5ndGgsYz0hMTtmb3IoXCJib29sZWFuXCI9PXR5cGVvZiBzJiYoYz1zLHM9YXJndW1lbnRzWzFdfHx7fSx1PTIpLFwib2JqZWN0XCI9PXR5cGVvZiBzfHxiLmlzRnVuY3Rpb24ocyl8fChzPXt9KSxsPT09dSYmKHM9dGhpcywtLXUpO2w+dTt1KyspaWYobnVsbCE9KG89YXJndW1lbnRzW3VdKSlmb3IoaSBpbiBvKWU9c1tpXSxyPW9baV0scyE9PXImJihjJiZyJiYoYi5pc1BsYWluT2JqZWN0KHIpfHwobj1iLmlzQXJyYXkocikpKT8obj8obj0hMSxhPWUmJmIuaXNBcnJheShlKT9lOltdKTphPWUmJmIuaXNQbGFpbk9iamVjdChlKT9lOnt9LHNbaV09Yi5leHRlbmQoYyxhLHIpKTpyIT09dCYmKHNbaV09cikpO3JldHVybiBzfSxiLmV4dGVuZCh7bm9Db25mbGljdDpmdW5jdGlvbih0KXtyZXR1cm4gZS4kPT09YiYmKGUuJD11KSx0JiZlLmpRdWVyeT09PWImJihlLmpRdWVyeT1zKSxifSxpc1JlYWR5OiExLHJlYWR5V2FpdDoxLGhvbGRSZWFkeTpmdW5jdGlvbihlKXtlP2IucmVhZHlXYWl0Kys6Yi5yZWFkeSghMCl9LHJlYWR5OmZ1bmN0aW9uKGUpe2lmKGU9PT0hMD8hLS1iLnJlYWR5V2FpdDohYi5pc1JlYWR5KXtpZighby5ib2R5KXJldHVybiBzZXRUaW1lb3V0KGIucmVhZHkpO2IuaXNSZWFkeT0hMCxlIT09ITAmJi0tYi5yZWFkeVdhaXQ+MHx8KG4ucmVzb2x2ZVdpdGgobyxbYl0pLGIuZm4udHJpZ2dlciYmYihvKS50cmlnZ2VyKFwicmVhZHlcIikub2ZmKFwicmVhZHlcIikpfX0saXNGdW5jdGlvbjpmdW5jdGlvbihlKXtyZXR1cm5cImZ1bmN0aW9uXCI9PT1iLnR5cGUoZSl9LGlzQXJyYXk6QXJyYXkuaXNBcnJheXx8ZnVuY3Rpb24oZSl7cmV0dXJuXCJhcnJheVwiPT09Yi50eXBlKGUpfSxpc1dpbmRvdzpmdW5jdGlvbihlKXtyZXR1cm4gbnVsbCE9ZSYmZT09ZS53aW5kb3d9LGlzTnVtZXJpYzpmdW5jdGlvbihlKXtyZXR1cm4haXNOYU4ocGFyc2VGbG9hdChlKSkmJmlzRmluaXRlKGUpfSx0eXBlOmZ1bmN0aW9uKGUpe3JldHVybiBudWxsPT1lP2UrXCJcIjpcIm9iamVjdFwiPT10eXBlb2YgZXx8XCJmdW5jdGlvblwiPT10eXBlb2YgZT9sW20uY2FsbChlKV18fFwib2JqZWN0XCI6dHlwZW9mIGV9LGlzUGxhaW5PYmplY3Q6ZnVuY3Rpb24oZSl7aWYoIWV8fFwib2JqZWN0XCIhPT1iLnR5cGUoZSl8fGUubm9kZVR5cGV8fGIuaXNXaW5kb3coZSkpcmV0dXJuITE7dHJ5e2lmKGUuY29uc3RydWN0b3ImJiF5LmNhbGwoZSxcImNvbnN0cnVjdG9yXCIpJiYheS5jYWxsKGUuY29uc3RydWN0b3IucHJvdG90eXBlLFwiaXNQcm90b3R5cGVPZlwiKSlyZXR1cm4hMX1jYXRjaChuKXtyZXR1cm4hMX12YXIgcjtmb3IociBpbiBlKTtyZXR1cm4gcj09PXR8fHkuY2FsbChlLHIpfSxpc0VtcHR5T2JqZWN0OmZ1bmN0aW9uKGUpe3ZhciB0O2Zvcih0IGluIGUpcmV0dXJuITE7cmV0dXJuITB9LGVycm9yOmZ1bmN0aW9uKGUpe3Rocm93IEVycm9yKGUpfSxwYXJzZUhUTUw6ZnVuY3Rpb24oZSx0LG4pe2lmKCFlfHxcInN0cmluZ1wiIT10eXBlb2YgZSlyZXR1cm4gbnVsbDtcImJvb2xlYW5cIj09dHlwZW9mIHQmJihuPXQsdD0hMSksdD10fHxvO3ZhciByPUMuZXhlYyhlKSxpPSFuJiZbXTtyZXR1cm4gcj9bdC5jcmVhdGVFbGVtZW50KHJbMV0pXToocj1iLmJ1aWxkRnJhZ21lbnQoW2VdLHQsaSksaSYmYihpKS5yZW1vdmUoKSxiLm1lcmdlKFtdLHIuY2hpbGROb2RlcykpfSxwYXJzZUpTT046ZnVuY3Rpb24obil7cmV0dXJuIGUuSlNPTiYmZS5KU09OLnBhcnNlP2UuSlNPTi5wYXJzZShuKTpudWxsPT09bj9uOlwic3RyaW5nXCI9PXR5cGVvZiBuJiYobj1iLnRyaW0obiksbiYmay50ZXN0KG4ucmVwbGFjZShTLFwiQFwiKS5yZXBsYWNlKEEsXCJdXCIpLnJlcGxhY2UoRSxcIlwiKSkpP0Z1bmN0aW9uKFwicmV0dXJuIFwiK24pKCk6KGIuZXJyb3IoXCJJbnZhbGlkIEpTT046IFwiK24pLHQpfSxwYXJzZVhNTDpmdW5jdGlvbihuKXt2YXIgcixpO2lmKCFufHxcInN0cmluZ1wiIT10eXBlb2YgbilyZXR1cm4gbnVsbDt0cnl7ZS5ET01QYXJzZXI/KGk9bmV3IERPTVBhcnNlcixyPWkucGFyc2VGcm9tU3RyaW5nKG4sXCJ0ZXh0L3htbFwiKSk6KHI9bmV3IEFjdGl2ZVhPYmplY3QoXCJNaWNyb3NvZnQuWE1MRE9NXCIpLHIuYXN5bmM9XCJmYWxzZVwiLHIubG9hZFhNTChuKSl9Y2F0Y2gobyl7cj10fXJldHVybiByJiZyLmRvY3VtZW50RWxlbWVudCYmIXIuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJwYXJzZXJlcnJvclwiKS5sZW5ndGh8fGIuZXJyb3IoXCJJbnZhbGlkIFhNTDogXCIrbikscn0sbm9vcDpmdW5jdGlvbigpe30sZ2xvYmFsRXZhbDpmdW5jdGlvbih0KXt0JiZiLnRyaW0odCkmJihlLmV4ZWNTY3JpcHR8fGZ1bmN0aW9uKHQpe2UuZXZhbC5jYWxsKGUsdCl9KSh0KX0sY2FtZWxDYXNlOmZ1bmN0aW9uKGUpe3JldHVybiBlLnJlcGxhY2UoaixcIm1zLVwiKS5yZXBsYWNlKEQsTCl9LG5vZGVOYW1lOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIGUubm9kZU5hbWUmJmUubm9kZU5hbWUudG9Mb3dlckNhc2UoKT09PXQudG9Mb3dlckNhc2UoKX0sZWFjaDpmdW5jdGlvbihlLHQsbil7dmFyIHIsaT0wLG89ZS5sZW5ndGgsYT1NKGUpO2lmKG4pe2lmKGEpe2Zvcig7bz5pO2krKylpZihyPXQuYXBwbHkoZVtpXSxuKSxyPT09ITEpYnJlYWt9ZWxzZSBmb3IoaSBpbiBlKWlmKHI9dC5hcHBseShlW2ldLG4pLHI9PT0hMSlicmVha31lbHNlIGlmKGEpe2Zvcig7bz5pO2krKylpZihyPXQuY2FsbChlW2ldLGksZVtpXSkscj09PSExKWJyZWFrfWVsc2UgZm9yKGkgaW4gZSlpZihyPXQuY2FsbChlW2ldLGksZVtpXSkscj09PSExKWJyZWFrO3JldHVybiBlfSx0cmltOnYmJiF2LmNhbGwoXCJcXHVmZWZmXFx1MDBhMFwiKT9mdW5jdGlvbihlKXtyZXR1cm4gbnVsbD09ZT9cIlwiOnYuY2FsbChlKX06ZnVuY3Rpb24oZSl7cmV0dXJuIG51bGw9PWU/XCJcIjooZStcIlwiKS5yZXBsYWNlKFQsXCJcIil9LG1ha2VBcnJheTpmdW5jdGlvbihlLHQpe3ZhciBuPXR8fFtdO3JldHVybiBudWxsIT1lJiYoTShPYmplY3QoZSkpP2IubWVyZ2UobixcInN0cmluZ1wiPT10eXBlb2YgZT9bZV06ZSk6ZC5jYWxsKG4sZSkpLG59LGluQXJyYXk6ZnVuY3Rpb24oZSx0LG4pe3ZhciByO2lmKHQpe2lmKGcpcmV0dXJuIGcuY2FsbCh0LGUsbik7Zm9yKHI9dC5sZW5ndGgsbj1uPzA+bj9NYXRoLm1heCgwLHIrbik6bjowO3I+bjtuKyspaWYobiBpbiB0JiZ0W25dPT09ZSlyZXR1cm4gbn1yZXR1cm4tMX0sbWVyZ2U6ZnVuY3Rpb24oZSxuKXt2YXIgcj1uLmxlbmd0aCxpPWUubGVuZ3RoLG89MDtpZihcIm51bWJlclwiPT10eXBlb2Ygcilmb3IoO3I+bztvKyspZVtpKytdPW5bb107ZWxzZSB3aGlsZShuW29dIT09dCllW2krK109bltvKytdO3JldHVybiBlLmxlbmd0aD1pLGV9LGdyZXA6ZnVuY3Rpb24oZSx0LG4pe3ZhciByLGk9W10sbz0wLGE9ZS5sZW5ndGg7Zm9yKG49ISFuO2E+bztvKyspcj0hIXQoZVtvXSxvKSxuIT09ciYmaS5wdXNoKGVbb10pO3JldHVybiBpfSxtYXA6ZnVuY3Rpb24oZSx0LG4pe3ZhciByLGk9MCxvPWUubGVuZ3RoLGE9TShlKSxzPVtdO2lmKGEpZm9yKDtvPmk7aSsrKXI9dChlW2ldLGksbiksbnVsbCE9ciYmKHNbcy5sZW5ndGhdPXIpO2Vsc2UgZm9yKGkgaW4gZSlyPXQoZVtpXSxpLG4pLG51bGwhPXImJihzW3MubGVuZ3RoXT1yKTtyZXR1cm4gZi5hcHBseShbXSxzKX0sZ3VpZDoxLHByb3h5OmZ1bmN0aW9uKGUsbil7dmFyIHIsaSxvO3JldHVyblwic3RyaW5nXCI9PXR5cGVvZiBuJiYobz1lW25dLG49ZSxlPW8pLGIuaXNGdW5jdGlvbihlKT8ocj1oLmNhbGwoYXJndW1lbnRzLDIpLGk9ZnVuY3Rpb24oKXtyZXR1cm4gZS5hcHBseShufHx0aGlzLHIuY29uY2F0KGguY2FsbChhcmd1bWVudHMpKSl9LGkuZ3VpZD1lLmd1aWQ9ZS5ndWlkfHxiLmd1aWQrKyxpKTp0fSxhY2Nlc3M6ZnVuY3Rpb24oZSxuLHIsaSxvLGEscyl7dmFyIHU9MCxsPWUubGVuZ3RoLGM9bnVsbD09cjtpZihcIm9iamVjdFwiPT09Yi50eXBlKHIpKXtvPSEwO2Zvcih1IGluIHIpYi5hY2Nlc3MoZSxuLHUsclt1XSwhMCxhLHMpfWVsc2UgaWYoaSE9PXQmJihvPSEwLGIuaXNGdW5jdGlvbihpKXx8KHM9ITApLGMmJihzPyhuLmNhbGwoZSxpKSxuPW51bGwpOihjPW4sbj1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGMuY2FsbChiKGUpLG4pfSkpLG4pKWZvcig7bD51O3UrKyluKGVbdV0scixzP2k6aS5jYWxsKGVbdV0sdSxuKGVbdV0scikpKTtyZXR1cm4gbz9lOmM/bi5jYWxsKGUpOmw/bihlWzBdLHIpOmF9LG5vdzpmdW5jdGlvbigpe3JldHVybihuZXcgRGF0ZSkuZ2V0VGltZSgpfX0pLGIucmVhZHkucHJvbWlzZT1mdW5jdGlvbih0KXtpZighbilpZihuPWIuRGVmZXJyZWQoKSxcImNvbXBsZXRlXCI9PT1vLnJlYWR5U3RhdGUpc2V0VGltZW91dChiLnJlYWR5KTtlbHNlIGlmKG8uYWRkRXZlbnRMaXN0ZW5lcilvLmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsSCwhMSksZS5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLEgsITEpO2Vsc2V7by5hdHRhY2hFdmVudChcIm9ucmVhZHlzdGF0ZWNoYW5nZVwiLEgpLGUuYXR0YWNoRXZlbnQoXCJvbmxvYWRcIixIKTt2YXIgcj0hMTt0cnl7cj1udWxsPT1lLmZyYW1lRWxlbWVudCYmby5kb2N1bWVudEVsZW1lbnR9Y2F0Y2goaSl7fXImJnIuZG9TY3JvbGwmJmZ1bmN0aW9uIGEoKXtpZighYi5pc1JlYWR5KXt0cnl7ci5kb1Njcm9sbChcImxlZnRcIil9Y2F0Y2goZSl7cmV0dXJuIHNldFRpbWVvdXQoYSw1MCl9cSgpLGIucmVhZHkoKX19KCl9cmV0dXJuIG4ucHJvbWlzZSh0KX0sYi5lYWNoKFwiQm9vbGVhbiBOdW1iZXIgU3RyaW5nIEZ1bmN0aW9uIEFycmF5IERhdGUgUmVnRXhwIE9iamVjdCBFcnJvclwiLnNwbGl0KFwiIFwiKSxmdW5jdGlvbihlLHQpe2xbXCJbb2JqZWN0IFwiK3QrXCJdXCJdPXQudG9Mb3dlckNhc2UoKX0pO2Z1bmN0aW9uIE0oZSl7dmFyIHQ9ZS5sZW5ndGgsbj1iLnR5cGUoZSk7cmV0dXJuIGIuaXNXaW5kb3coZSk/ITE6MT09PWUubm9kZVR5cGUmJnQ/ITA6XCJhcnJheVwiPT09bnx8XCJmdW5jdGlvblwiIT09biYmKDA9PT10fHxcIm51bWJlclwiPT10eXBlb2YgdCYmdD4wJiZ0LTEgaW4gZSl9cj1iKG8pO3ZhciBfPXt9O2Z1bmN0aW9uIEYoZSl7dmFyIHQ9X1tlXT17fTtyZXR1cm4gYi5lYWNoKGUubWF0Y2godyl8fFtdLGZ1bmN0aW9uKGUsbil7dFtuXT0hMH0pLHR9Yi5DYWxsYmFja3M9ZnVuY3Rpb24oZSl7ZT1cInN0cmluZ1wiPT10eXBlb2YgZT9fW2VdfHxGKGUpOmIuZXh0ZW5kKHt9LGUpO3ZhciBuLHIsaSxvLGEscyx1PVtdLGw9IWUub25jZSYmW10sYz1mdW5jdGlvbih0KXtmb3Iocj1lLm1lbW9yeSYmdCxpPSEwLGE9c3x8MCxzPTAsbz11Lmxlbmd0aCxuPSEwO3UmJm8+YTthKyspaWYodVthXS5hcHBseSh0WzBdLHRbMV0pPT09ITEmJmUuc3RvcE9uRmFsc2Upe3I9ITE7YnJlYWt9bj0hMSx1JiYobD9sLmxlbmd0aCYmYyhsLnNoaWZ0KCkpOnI/dT1bXTpwLmRpc2FibGUoKSl9LHA9e2FkZDpmdW5jdGlvbigpe2lmKHUpe3ZhciB0PXUubGVuZ3RoOyhmdW5jdGlvbiBpKHQpe2IuZWFjaCh0LGZ1bmN0aW9uKHQsbil7dmFyIHI9Yi50eXBlKG4pO1wiZnVuY3Rpb25cIj09PXI/ZS51bmlxdWUmJnAuaGFzKG4pfHx1LnB1c2gobik6biYmbi5sZW5ndGgmJlwic3RyaW5nXCIhPT1yJiZpKG4pfSl9KShhcmd1bWVudHMpLG4/bz11Lmxlbmd0aDpyJiYocz10LGMocikpfXJldHVybiB0aGlzfSxyZW1vdmU6ZnVuY3Rpb24oKXtyZXR1cm4gdSYmYi5lYWNoKGFyZ3VtZW50cyxmdW5jdGlvbihlLHQpe3ZhciByO3doaWxlKChyPWIuaW5BcnJheSh0LHUscikpPi0xKXUuc3BsaWNlKHIsMSksbiYmKG8+PXImJm8tLSxhPj1yJiZhLS0pfSksdGhpc30saGFzOmZ1bmN0aW9uKGUpe3JldHVybiBlP2IuaW5BcnJheShlLHUpPi0xOiEoIXV8fCF1Lmxlbmd0aCl9LGVtcHR5OmZ1bmN0aW9uKCl7cmV0dXJuIHU9W10sdGhpc30sZGlzYWJsZTpmdW5jdGlvbigpe3JldHVybiB1PWw9cj10LHRoaXN9LGRpc2FibGVkOmZ1bmN0aW9uKCl7cmV0dXJuIXV9LGxvY2s6ZnVuY3Rpb24oKXtyZXR1cm4gbD10LHJ8fHAuZGlzYWJsZSgpLHRoaXN9LGxvY2tlZDpmdW5jdGlvbigpe3JldHVybiFsfSxmaXJlV2l0aDpmdW5jdGlvbihlLHQpe3JldHVybiB0PXR8fFtdLHQ9W2UsdC5zbGljZT90LnNsaWNlKCk6dF0sIXV8fGkmJiFsfHwobj9sLnB1c2godCk6Yyh0KSksdGhpc30sZmlyZTpmdW5jdGlvbigpe3JldHVybiBwLmZpcmVXaXRoKHRoaXMsYXJndW1lbnRzKSx0aGlzfSxmaXJlZDpmdW5jdGlvbigpe3JldHVybiEhaX19O3JldHVybiBwfSxiLmV4dGVuZCh7RGVmZXJyZWQ6ZnVuY3Rpb24oZSl7dmFyIHQ9W1tcInJlc29sdmVcIixcImRvbmVcIixiLkNhbGxiYWNrcyhcIm9uY2UgbWVtb3J5XCIpLFwicmVzb2x2ZWRcIl0sW1wicmVqZWN0XCIsXCJmYWlsXCIsYi5DYWxsYmFja3MoXCJvbmNlIG1lbW9yeVwiKSxcInJlamVjdGVkXCJdLFtcIm5vdGlmeVwiLFwicHJvZ3Jlc3NcIixiLkNhbGxiYWNrcyhcIm1lbW9yeVwiKV1dLG49XCJwZW5kaW5nXCIscj17c3RhdGU6ZnVuY3Rpb24oKXtyZXR1cm4gbn0sYWx3YXlzOmZ1bmN0aW9uKCl7cmV0dXJuIGkuZG9uZShhcmd1bWVudHMpLmZhaWwoYXJndW1lbnRzKSx0aGlzfSx0aGVuOmZ1bmN0aW9uKCl7dmFyIGU9YXJndW1lbnRzO3JldHVybiBiLkRlZmVycmVkKGZ1bmN0aW9uKG4pe2IuZWFjaCh0LGZ1bmN0aW9uKHQsbyl7dmFyIGE9b1swXSxzPWIuaXNGdW5jdGlvbihlW3RdKSYmZVt0XTtpW29bMV1dKGZ1bmN0aW9uKCl7dmFyIGU9cyYmcy5hcHBseSh0aGlzLGFyZ3VtZW50cyk7ZSYmYi5pc0Z1bmN0aW9uKGUucHJvbWlzZSk/ZS5wcm9taXNlKCkuZG9uZShuLnJlc29sdmUpLmZhaWwobi5yZWplY3QpLnByb2dyZXNzKG4ubm90aWZ5KTpuW2ErXCJXaXRoXCJdKHRoaXM9PT1yP24ucHJvbWlzZSgpOnRoaXMscz9bZV06YXJndW1lbnRzKX0pfSksZT1udWxsfSkucHJvbWlzZSgpfSxwcm9taXNlOmZ1bmN0aW9uKGUpe3JldHVybiBudWxsIT1lP2IuZXh0ZW5kKGUscik6cn19LGk9e307cmV0dXJuIHIucGlwZT1yLnRoZW4sYi5lYWNoKHQsZnVuY3Rpb24oZSxvKXt2YXIgYT1vWzJdLHM9b1szXTtyW29bMV1dPWEuYWRkLHMmJmEuYWRkKGZ1bmN0aW9uKCl7bj1zfSx0WzFeZV1bMl0uZGlzYWJsZSx0WzJdWzJdLmxvY2spLGlbb1swXV09ZnVuY3Rpb24oKXtyZXR1cm4gaVtvWzBdK1wiV2l0aFwiXSh0aGlzPT09aT9yOnRoaXMsYXJndW1lbnRzKSx0aGlzfSxpW29bMF0rXCJXaXRoXCJdPWEuZmlyZVdpdGh9KSxyLnByb21pc2UoaSksZSYmZS5jYWxsKGksaSksaX0sd2hlbjpmdW5jdGlvbihlKXt2YXIgdD0wLG49aC5jYWxsKGFyZ3VtZW50cykscj1uLmxlbmd0aCxpPTEhPT1yfHxlJiZiLmlzRnVuY3Rpb24oZS5wcm9taXNlKT9yOjAsbz0xPT09aT9lOmIuRGVmZXJyZWQoKSxhPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZnVuY3Rpb24ocil7dFtlXT10aGlzLG5bZV09YXJndW1lbnRzLmxlbmd0aD4xP2guY2FsbChhcmd1bWVudHMpOnIsbj09PXM/by5ub3RpZnlXaXRoKHQsbik6LS1pfHxvLnJlc29sdmVXaXRoKHQsbil9fSxzLHUsbDtpZihyPjEpZm9yKHM9QXJyYXkociksdT1BcnJheShyKSxsPUFycmF5KHIpO3I+dDt0Kyspblt0XSYmYi5pc0Z1bmN0aW9uKG5bdF0ucHJvbWlzZSk/blt0XS5wcm9taXNlKCkuZG9uZShhKHQsbCxuKSkuZmFpbChvLnJlamVjdCkucHJvZ3Jlc3MoYSh0LHUscykpOi0taTtyZXR1cm4gaXx8by5yZXNvbHZlV2l0aChsLG4pLG8ucHJvbWlzZSgpfX0pLGIuc3VwcG9ydD1mdW5jdGlvbigpe3ZhciB0LG4scixhLHMsdSxsLGMscCxmLGQ9by5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO2lmKGQuc2V0QXR0cmlidXRlKFwiY2xhc3NOYW1lXCIsXCJ0XCIpLGQuaW5uZXJIVE1MPVwiICA8bGluay8+PHRhYmxlPjwvdGFibGU+PGEgaHJlZj0nL2EnPmE8L2E+PGlucHV0IHR5cGU9J2NoZWNrYm94Jy8+XCIsbj1kLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiKlwiKSxyPWQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJhXCIpWzBdLCFufHwhcnx8IW4ubGVuZ3RoKXJldHVybnt9O3M9by5jcmVhdGVFbGVtZW50KFwic2VsZWN0XCIpLGw9cy5hcHBlbmRDaGlsZChvLmNyZWF0ZUVsZW1lbnQoXCJvcHRpb25cIikpLGE9ZC5nZXRFbGVtZW50c0J5VGFnTmFtZShcImlucHV0XCIpWzBdLHIuc3R5bGUuY3NzVGV4dD1cInRvcDoxcHg7ZmxvYXQ6bGVmdDtvcGFjaXR5Oi41XCIsdD17Z2V0U2V0QXR0cmlidXRlOlwidFwiIT09ZC5jbGFzc05hbWUsbGVhZGluZ1doaXRlc3BhY2U6Mz09PWQuZmlyc3RDaGlsZC5ub2RlVHlwZSx0Ym9keTohZC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInRib2R5XCIpLmxlbmd0aCxodG1sU2VyaWFsaXplOiEhZC5nZXRFbGVtZW50c0J5VGFnTmFtZShcImxpbmtcIikubGVuZ3RoLHN0eWxlOi90b3AvLnRlc3Qoci5nZXRBdHRyaWJ1dGUoXCJzdHlsZVwiKSksaHJlZk5vcm1hbGl6ZWQ6XCIvYVwiPT09ci5nZXRBdHRyaWJ1dGUoXCJocmVmXCIpLG9wYWNpdHk6L14wLjUvLnRlc3Qoci5zdHlsZS5vcGFjaXR5KSxjc3NGbG9hdDohIXIuc3R5bGUuY3NzRmxvYXQsY2hlY2tPbjohIWEudmFsdWUsb3B0U2VsZWN0ZWQ6bC5zZWxlY3RlZCxlbmN0eXBlOiEhby5jcmVhdGVFbGVtZW50KFwiZm9ybVwiKS5lbmN0eXBlLGh0bWw1Q2xvbmU6XCI8Om5hdj48LzpuYXY+XCIhPT1vLmNyZWF0ZUVsZW1lbnQoXCJuYXZcIikuY2xvbmVOb2RlKCEwKS5vdXRlckhUTUwsYm94TW9kZWw6XCJDU1MxQ29tcGF0XCI9PT1vLmNvbXBhdE1vZGUsZGVsZXRlRXhwYW5kbzohMCxub0Nsb25lRXZlbnQ6ITAsaW5saW5lQmxvY2tOZWVkc0xheW91dDohMSxzaHJpbmtXcmFwQmxvY2tzOiExLHJlbGlhYmxlTWFyZ2luUmlnaHQ6ITAsYm94U2l6aW5nUmVsaWFibGU6ITAscGl4ZWxQb3NpdGlvbjohMX0sYS5jaGVja2VkPSEwLHQubm9DbG9uZUNoZWNrZWQ9YS5jbG9uZU5vZGUoITApLmNoZWNrZWQscy5kaXNhYmxlZD0hMCx0Lm9wdERpc2FibGVkPSFsLmRpc2FibGVkO3RyeXtkZWxldGUgZC50ZXN0fWNhdGNoKGgpe3QuZGVsZXRlRXhwYW5kbz0hMX1hPW8uY3JlYXRlRWxlbWVudChcImlucHV0XCIpLGEuc2V0QXR0cmlidXRlKFwidmFsdWVcIixcIlwiKSx0LmlucHV0PVwiXCI9PT1hLmdldEF0dHJpYnV0ZShcInZhbHVlXCIpLGEudmFsdWU9XCJ0XCIsYS5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsXCJyYWRpb1wiKSx0LnJhZGlvVmFsdWU9XCJ0XCI9PT1hLnZhbHVlLGEuc2V0QXR0cmlidXRlKFwiY2hlY2tlZFwiLFwidFwiKSxhLnNldEF0dHJpYnV0ZShcIm5hbWVcIixcInRcIiksdT1vLmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKSx1LmFwcGVuZENoaWxkKGEpLHQuYXBwZW5kQ2hlY2tlZD1hLmNoZWNrZWQsdC5jaGVja0Nsb25lPXUuY2xvbmVOb2RlKCEwKS5jbG9uZU5vZGUoITApLmxhc3RDaGlsZC5jaGVja2VkLGQuYXR0YWNoRXZlbnQmJihkLmF0dGFjaEV2ZW50KFwib25jbGlja1wiLGZ1bmN0aW9uKCl7dC5ub0Nsb25lRXZlbnQ9ITF9KSxkLmNsb25lTm9kZSghMCkuY2xpY2soKSk7Zm9yKGYgaW57c3VibWl0OiEwLGNoYW5nZTohMCxmb2N1c2luOiEwfSlkLnNldEF0dHJpYnV0ZShjPVwib25cIitmLFwidFwiKSx0W2YrXCJCdWJibGVzXCJdPWMgaW4gZXx8ZC5hdHRyaWJ1dGVzW2NdLmV4cGFuZG89PT0hMTtyZXR1cm4gZC5zdHlsZS5iYWNrZ3JvdW5kQ2xpcD1cImNvbnRlbnQtYm94XCIsZC5jbG9uZU5vZGUoITApLnN0eWxlLmJhY2tncm91bmRDbGlwPVwiXCIsdC5jbGVhckNsb25lU3R5bGU9XCJjb250ZW50LWJveFwiPT09ZC5zdHlsZS5iYWNrZ3JvdW5kQ2xpcCxiKGZ1bmN0aW9uKCl7dmFyIG4scixhLHM9XCJwYWRkaW5nOjA7bWFyZ2luOjA7Ym9yZGVyOjA7ZGlzcGxheTpibG9jaztib3gtc2l6aW5nOmNvbnRlbnQtYm94Oy1tb3otYm94LXNpemluZzpjb250ZW50LWJveDstd2Via2l0LWJveC1zaXppbmc6Y29udGVudC1ib3g7XCIsdT1vLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiYm9keVwiKVswXTt1JiYobj1vLmNyZWF0ZUVsZW1lbnQoXCJkaXZcIiksbi5zdHlsZS5jc3NUZXh0PVwiYm9yZGVyOjA7d2lkdGg6MDtoZWlnaHQ6MDtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0Oi05OTk5cHg7bWFyZ2luLXRvcDoxcHhcIix1LmFwcGVuZENoaWxkKG4pLmFwcGVuZENoaWxkKGQpLGQuaW5uZXJIVE1MPVwiPHRhYmxlPjx0cj48dGQ+PC90ZD48dGQ+dDwvdGQ+PC90cj48L3RhYmxlPlwiLGE9ZC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInRkXCIpLGFbMF0uc3R5bGUuY3NzVGV4dD1cInBhZGRpbmc6MDttYXJnaW46MDtib3JkZXI6MDtkaXNwbGF5Om5vbmVcIixwPTA9PT1hWzBdLm9mZnNldEhlaWdodCxhWzBdLnN0eWxlLmRpc3BsYXk9XCJcIixhWzFdLnN0eWxlLmRpc3BsYXk9XCJub25lXCIsdC5yZWxpYWJsZUhpZGRlbk9mZnNldHM9cCYmMD09PWFbMF0ub2Zmc2V0SGVpZ2h0LGQuaW5uZXJIVE1MPVwiXCIsZC5zdHlsZS5jc3NUZXh0PVwiYm94LXNpemluZzpib3JkZXItYm94Oy1tb3otYm94LXNpemluZzpib3JkZXItYm94Oy13ZWJraXQtYm94LXNpemluZzpib3JkZXItYm94O3BhZGRpbmc6MXB4O2JvcmRlcjoxcHg7ZGlzcGxheTpibG9jazt3aWR0aDo0cHg7bWFyZ2luLXRvcDoxJTtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MSU7XCIsdC5ib3hTaXppbmc9ND09PWQub2Zmc2V0V2lkdGgsdC5kb2VzTm90SW5jbHVkZU1hcmdpbkluQm9keU9mZnNldD0xIT09dS5vZmZzZXRUb3AsZS5nZXRDb21wdXRlZFN0eWxlJiYodC5waXhlbFBvc2l0aW9uPVwiMSVcIiE9PShlLmdldENvbXB1dGVkU3R5bGUoZCxudWxsKXx8e30pLnRvcCx0LmJveFNpemluZ1JlbGlhYmxlPVwiNHB4XCI9PT0oZS5nZXRDb21wdXRlZFN0eWxlKGQsbnVsbCl8fHt3aWR0aDpcIjRweFwifSkud2lkdGgscj1kLmFwcGVuZENoaWxkKG8uY3JlYXRlRWxlbWVudChcImRpdlwiKSksci5zdHlsZS5jc3NUZXh0PWQuc3R5bGUuY3NzVGV4dD1zLHIuc3R5bGUubWFyZ2luUmlnaHQ9ci5zdHlsZS53aWR0aD1cIjBcIixkLnN0eWxlLndpZHRoPVwiMXB4XCIsdC5yZWxpYWJsZU1hcmdpblJpZ2h0PSFwYXJzZUZsb2F0KChlLmdldENvbXB1dGVkU3R5bGUocixudWxsKXx8e30pLm1hcmdpblJpZ2h0KSksdHlwZW9mIGQuc3R5bGUuem9vbSE9PWkmJihkLmlubmVySFRNTD1cIlwiLGQuc3R5bGUuY3NzVGV4dD1zK1wid2lkdGg6MXB4O3BhZGRpbmc6MXB4O2Rpc3BsYXk6aW5saW5lO3pvb206MVwiLHQuaW5saW5lQmxvY2tOZWVkc0xheW91dD0zPT09ZC5vZmZzZXRXaWR0aCxkLnN0eWxlLmRpc3BsYXk9XCJibG9ja1wiLGQuaW5uZXJIVE1MPVwiPGRpdj48L2Rpdj5cIixkLmZpcnN0Q2hpbGQuc3R5bGUud2lkdGg9XCI1cHhcIix0LnNocmlua1dyYXBCbG9ja3M9MyE9PWQub2Zmc2V0V2lkdGgsdC5pbmxpbmVCbG9ja05lZWRzTGF5b3V0JiYodS5zdHlsZS56b29tPTEpKSx1LnJlbW92ZUNoaWxkKG4pLG49ZD1hPXI9bnVsbCl9KSxuPXM9dT1sPXI9YT1udWxsLHR9KCk7dmFyIE89Lyg/Olxce1tcXHNcXFNdKlxcfXxcXFtbXFxzXFxTXSpcXF0pJC8sQj0vKFtBLVpdKS9nO2Z1bmN0aW9uIFAoZSxuLHIsaSl7aWYoYi5hY2NlcHREYXRhKGUpKXt2YXIgbyxhLHM9Yi5leHBhbmRvLHU9XCJzdHJpbmdcIj09dHlwZW9mIG4sbD1lLm5vZGVUeXBlLHA9bD9iLmNhY2hlOmUsZj1sP2Vbc106ZVtzXSYmcztpZihmJiZwW2ZdJiYoaXx8cFtmXS5kYXRhKXx8IXV8fHIhPT10KXJldHVybiBmfHwobD9lW3NdPWY9Yy5wb3AoKXx8Yi5ndWlkKys6Zj1zKSxwW2ZdfHwocFtmXT17fSxsfHwocFtmXS50b0pTT049Yi5ub29wKSksKFwib2JqZWN0XCI9PXR5cGVvZiBufHxcImZ1bmN0aW9uXCI9PXR5cGVvZiBuKSYmKGk/cFtmXT1iLmV4dGVuZChwW2ZdLG4pOnBbZl0uZGF0YT1iLmV4dGVuZChwW2ZdLmRhdGEsbikpLG89cFtmXSxpfHwoby5kYXRhfHwoby5kYXRhPXt9KSxvPW8uZGF0YSksciE9PXQmJihvW2IuY2FtZWxDYXNlKG4pXT1yKSx1PyhhPW9bbl0sbnVsbD09YSYmKGE9b1tiLmNhbWVsQ2FzZShuKV0pKTphPW8sYX19ZnVuY3Rpb24gUihlLHQsbil7aWYoYi5hY2NlcHREYXRhKGUpKXt2YXIgcixpLG8sYT1lLm5vZGVUeXBlLHM9YT9iLmNhY2hlOmUsdT1hP2VbYi5leHBhbmRvXTpiLmV4cGFuZG87aWYoc1t1XSl7aWYodCYmKG89bj9zW3VdOnNbdV0uZGF0YSkpe2IuaXNBcnJheSh0KT90PXQuY29uY2F0KGIubWFwKHQsYi5jYW1lbENhc2UpKTp0IGluIG8/dD1bdF06KHQ9Yi5jYW1lbENhc2UodCksdD10IGluIG8/W3RdOnQuc3BsaXQoXCIgXCIpKTtmb3Iocj0wLGk9dC5sZW5ndGg7aT5yO3IrKylkZWxldGUgb1t0W3JdXTtpZighKG4/JDpiLmlzRW1wdHlPYmplY3QpKG8pKXJldHVybn0obnx8KGRlbGV0ZSBzW3VdLmRhdGEsJChzW3VdKSkpJiYoYT9iLmNsZWFuRGF0YShbZV0sITApOmIuc3VwcG9ydC5kZWxldGVFeHBhbmRvfHxzIT1zLndpbmRvdz9kZWxldGUgc1t1XTpzW3VdPW51bGwpfX19Yi5leHRlbmQoe2NhY2hlOnt9LGV4cGFuZG86XCJqUXVlcnlcIisocCtNYXRoLnJhbmRvbSgpKS5yZXBsYWNlKC9cXEQvZyxcIlwiKSxub0RhdGE6e2VtYmVkOiEwLG9iamVjdDpcImNsc2lkOkQyN0NEQjZFLUFFNkQtMTFjZi05NkI4LTQ0NDU1MzU0MDAwMFwiLGFwcGxldDohMH0saGFzRGF0YTpmdW5jdGlvbihlKXtyZXR1cm4gZT1lLm5vZGVUeXBlP2IuY2FjaGVbZVtiLmV4cGFuZG9dXTplW2IuZXhwYW5kb10sISFlJiYhJChlKX0sZGF0YTpmdW5jdGlvbihlLHQsbil7cmV0dXJuIFAoZSx0LG4pfSxyZW1vdmVEYXRhOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIFIoZSx0KX0sX2RhdGE6ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBQKGUsdCxuLCEwKX0sX3JlbW92ZURhdGE6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gUihlLHQsITApfSxhY2NlcHREYXRhOmZ1bmN0aW9uKGUpe2lmKGUubm9kZVR5cGUmJjEhPT1lLm5vZGVUeXBlJiY5IT09ZS5ub2RlVHlwZSlyZXR1cm4hMTt2YXIgdD1lLm5vZGVOYW1lJiZiLm5vRGF0YVtlLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCldO3JldHVybiF0fHx0IT09ITAmJmUuZ2V0QXR0cmlidXRlKFwiY2xhc3NpZFwiKT09PXR9fSksYi5mbi5leHRlbmQoe2RhdGE6ZnVuY3Rpb24oZSxuKXt2YXIgcixpLG89dGhpc1swXSxhPTAscz1udWxsO2lmKGU9PT10KXtpZih0aGlzLmxlbmd0aCYmKHM9Yi5kYXRhKG8pLDE9PT1vLm5vZGVUeXBlJiYhYi5fZGF0YShvLFwicGFyc2VkQXR0cnNcIikpKXtmb3Iocj1vLmF0dHJpYnV0ZXM7ci5sZW5ndGg+YTthKyspaT1yW2FdLm5hbWUsaS5pbmRleE9mKFwiZGF0YS1cIil8fChpPWIuY2FtZWxDYXNlKGkuc2xpY2UoNSkpLFcobyxpLHNbaV0pKTtiLl9kYXRhKG8sXCJwYXJzZWRBdHRyc1wiLCEwKX1yZXR1cm4gc31yZXR1cm5cIm9iamVjdFwiPT10eXBlb2YgZT90aGlzLmVhY2goZnVuY3Rpb24oKXtiLmRhdGEodGhpcyxlKX0pOmIuYWNjZXNzKHRoaXMsZnVuY3Rpb24obil7cmV0dXJuIG49PT10P28/VyhvLGUsYi5kYXRhKG8sZSkpOm51bGw6KHRoaXMuZWFjaChmdW5jdGlvbigpe2IuZGF0YSh0aGlzLGUsbil9KSx0KX0sbnVsbCxuLGFyZ3VtZW50cy5sZW5ndGg+MSxudWxsLCEwKX0scmVtb3ZlRGF0YTpmdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCl7Yi5yZW1vdmVEYXRhKHRoaXMsZSl9KX19KTtmdW5jdGlvbiBXKGUsbixyKXtpZihyPT09dCYmMT09PWUubm9kZVR5cGUpe3ZhciBpPVwiZGF0YS1cIituLnJlcGxhY2UoQixcIi0kMVwiKS50b0xvd2VyQ2FzZSgpO2lmKHI9ZS5nZXRBdHRyaWJ1dGUoaSksXCJzdHJpbmdcIj09dHlwZW9mIHIpe3RyeXtyPVwidHJ1ZVwiPT09cj8hMDpcImZhbHNlXCI9PT1yPyExOlwibnVsbFwiPT09cj9udWxsOityK1wiXCI9PT1yPytyOk8udGVzdChyKT9iLnBhcnNlSlNPTihyKTpyfWNhdGNoKG8pe31iLmRhdGEoZSxuLHIpfWVsc2Ugcj10fXJldHVybiByfWZ1bmN0aW9uICQoZSl7dmFyIHQ7Zm9yKHQgaW4gZSlpZigoXCJkYXRhXCIhPT10fHwhYi5pc0VtcHR5T2JqZWN0KGVbdF0pKSYmXCJ0b0pTT05cIiE9PXQpcmV0dXJuITE7cmV0dXJuITB9Yi5leHRlbmQoe3F1ZXVlOmZ1bmN0aW9uKGUsbixyKXt2YXIgaTtyZXR1cm4gZT8obj0obnx8XCJmeFwiKStcInF1ZXVlXCIsaT1iLl9kYXRhKGUsbiksciYmKCFpfHxiLmlzQXJyYXkocik/aT1iLl9kYXRhKGUsbixiLm1ha2VBcnJheShyKSk6aS5wdXNoKHIpKSxpfHxbXSk6dH0sZGVxdWV1ZTpmdW5jdGlvbihlLHQpe3Q9dHx8XCJmeFwiO3ZhciBuPWIucXVldWUoZSx0KSxyPW4ubGVuZ3RoLGk9bi5zaGlmdCgpLG89Yi5fcXVldWVIb29rcyhlLHQpLGE9ZnVuY3Rpb24oKXtiLmRlcXVldWUoZSx0KX07XCJpbnByb2dyZXNzXCI9PT1pJiYoaT1uLnNoaWZ0KCksci0tKSxvLmN1cj1pLGkmJihcImZ4XCI9PT10JiZuLnVuc2hpZnQoXCJpbnByb2dyZXNzXCIpLGRlbGV0ZSBvLnN0b3AsaS5jYWxsKGUsYSxvKSksIXImJm8mJm8uZW1wdHkuZmlyZSgpfSxfcXVldWVIb29rczpmdW5jdGlvbihlLHQpe3ZhciBuPXQrXCJxdWV1ZUhvb2tzXCI7cmV0dXJuIGIuX2RhdGEoZSxuKXx8Yi5fZGF0YShlLG4se2VtcHR5OmIuQ2FsbGJhY2tzKFwib25jZSBtZW1vcnlcIikuYWRkKGZ1bmN0aW9uKCl7Yi5fcmVtb3ZlRGF0YShlLHQrXCJxdWV1ZVwiKSxiLl9yZW1vdmVEYXRhKGUsbil9KX0pfX0pLGIuZm4uZXh0ZW5kKHtxdWV1ZTpmdW5jdGlvbihlLG4pe3ZhciByPTI7cmV0dXJuXCJzdHJpbmdcIiE9dHlwZW9mIGUmJihuPWUsZT1cImZ4XCIsci0tKSxyPmFyZ3VtZW50cy5sZW5ndGg/Yi5xdWV1ZSh0aGlzWzBdLGUpOm49PT10P3RoaXM6dGhpcy5lYWNoKGZ1bmN0aW9uKCl7dmFyIHQ9Yi5xdWV1ZSh0aGlzLGUsbik7Yi5fcXVldWVIb29rcyh0aGlzLGUpLFwiZnhcIj09PWUmJlwiaW5wcm9ncmVzc1wiIT09dFswXSYmYi5kZXF1ZXVlKHRoaXMsZSl9KX0sZGVxdWV1ZTpmdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCl7Yi5kZXF1ZXVlKHRoaXMsZSl9KX0sZGVsYXk6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZT1iLmZ4P2IuZnguc3BlZWRzW2VdfHxlOmUsdD10fHxcImZ4XCIsdGhpcy5xdWV1ZSh0LGZ1bmN0aW9uKHQsbil7dmFyIHI9c2V0VGltZW91dCh0LGUpO24uc3RvcD1mdW5jdGlvbigpe2NsZWFyVGltZW91dChyKX19KX0sY2xlYXJRdWV1ZTpmdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5xdWV1ZShlfHxcImZ4XCIsW10pfSxwcm9taXNlOmZ1bmN0aW9uKGUsbil7dmFyIHIsaT0xLG89Yi5EZWZlcnJlZCgpLGE9dGhpcyxzPXRoaXMubGVuZ3RoLHU9ZnVuY3Rpb24oKXstLWl8fG8ucmVzb2x2ZVdpdGgoYSxbYV0pfTtcInN0cmluZ1wiIT10eXBlb2YgZSYmKG49ZSxlPXQpLGU9ZXx8XCJmeFwiO3doaWxlKHMtLSlyPWIuX2RhdGEoYVtzXSxlK1wicXVldWVIb29rc1wiKSxyJiZyLmVtcHR5JiYoaSsrLHIuZW1wdHkuYWRkKHUpKTtyZXR1cm4gdSgpLG8ucHJvbWlzZShuKX19KTt2YXIgSSx6LFg9L1tcXHRcXHJcXG5dL2csVT0vXFxyL2csVj0vXig/OmlucHV0fHNlbGVjdHx0ZXh0YXJlYXxidXR0b258b2JqZWN0KSQvaSxZPS9eKD86YXxhcmVhKSQvaSxKPS9eKD86Y2hlY2tlZHxzZWxlY3RlZHxhdXRvZm9jdXN8YXV0b3BsYXl8YXN5bmN8Y29udHJvbHN8ZGVmZXJ8ZGlzYWJsZWR8aGlkZGVufGxvb3B8bXVsdGlwbGV8b3BlbnxyZWFkb25seXxyZXF1aXJlZHxzY29wZWQpJC9pLEc9L14oPzpjaGVja2VkfHNlbGVjdGVkKSQvaSxRPWIuc3VwcG9ydC5nZXRTZXRBdHRyaWJ1dGUsSz1iLnN1cHBvcnQuaW5wdXQ7Yi5mbi5leHRlbmQoe2F0dHI6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gYi5hY2Nlc3ModGhpcyxiLmF0dHIsZSx0LGFyZ3VtZW50cy5sZW5ndGg+MSl9LHJlbW92ZUF0dHI6ZnVuY3Rpb24oZSl7cmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbigpe2IucmVtb3ZlQXR0cih0aGlzLGUpfSl9LHByb3A6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gYi5hY2Nlc3ModGhpcyxiLnByb3AsZSx0LGFyZ3VtZW50cy5sZW5ndGg+MSl9LHJlbW92ZVByb3A6ZnVuY3Rpb24oZSl7cmV0dXJuIGU9Yi5wcm9wRml4W2VdfHxlLHRoaXMuZWFjaChmdW5jdGlvbigpe3RyeXt0aGlzW2VdPXQsZGVsZXRlIHRoaXNbZV19Y2F0Y2gobil7fX0pfSxhZGRDbGFzczpmdW5jdGlvbihlKXt2YXIgdCxuLHIsaSxvLGE9MCxzPXRoaXMubGVuZ3RoLHU9XCJzdHJpbmdcIj09dHlwZW9mIGUmJmU7aWYoYi5pc0Z1bmN0aW9uKGUpKXJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24odCl7Yih0aGlzKS5hZGRDbGFzcyhlLmNhbGwodGhpcyx0LHRoaXMuY2xhc3NOYW1lKSl9KTtpZih1KWZvcih0PShlfHxcIlwiKS5tYXRjaCh3KXx8W107cz5hO2ErKylpZihuPXRoaXNbYV0scj0xPT09bi5ub2RlVHlwZSYmKG4uY2xhc3NOYW1lPyhcIiBcIituLmNsYXNzTmFtZStcIiBcIikucmVwbGFjZShYLFwiIFwiKTpcIiBcIikpe289MDt3aGlsZShpPXRbbysrXSkwPnIuaW5kZXhPZihcIiBcIitpK1wiIFwiKSYmKHIrPWkrXCIgXCIpO24uY2xhc3NOYW1lPWIudHJpbShyKX1yZXR1cm4gdGhpc30scmVtb3ZlQ2xhc3M6ZnVuY3Rpb24oZSl7dmFyIHQsbixyLGksbyxhPTAscz10aGlzLmxlbmd0aCx1PTA9PT1hcmd1bWVudHMubGVuZ3RofHxcInN0cmluZ1wiPT10eXBlb2YgZSYmZTtpZihiLmlzRnVuY3Rpb24oZSkpcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbih0KXtiKHRoaXMpLnJlbW92ZUNsYXNzKGUuY2FsbCh0aGlzLHQsdGhpcy5jbGFzc05hbWUpKX0pO2lmKHUpZm9yKHQ9KGV8fFwiXCIpLm1hdGNoKHcpfHxbXTtzPmE7YSsrKWlmKG49dGhpc1thXSxyPTE9PT1uLm5vZGVUeXBlJiYobi5jbGFzc05hbWU/KFwiIFwiK24uY2xhc3NOYW1lK1wiIFwiKS5yZXBsYWNlKFgsXCIgXCIpOlwiXCIpKXtvPTA7d2hpbGUoaT10W28rK10pd2hpbGUoci5pbmRleE9mKFwiIFwiK2krXCIgXCIpPj0wKXI9ci5yZXBsYWNlKFwiIFwiK2krXCIgXCIsXCIgXCIpO24uY2xhc3NOYW1lPWU/Yi50cmltKHIpOlwiXCJ9cmV0dXJuIHRoaXN9LHRvZ2dsZUNsYXNzOmZ1bmN0aW9uKGUsdCl7dmFyIG49dHlwZW9mIGUscj1cImJvb2xlYW5cIj09dHlwZW9mIHQ7cmV0dXJuIGIuaXNGdW5jdGlvbihlKT90aGlzLmVhY2goZnVuY3Rpb24obil7Yih0aGlzKS50b2dnbGVDbGFzcyhlLmNhbGwodGhpcyxuLHRoaXMuY2xhc3NOYW1lLHQpLHQpfSk6dGhpcy5lYWNoKGZ1bmN0aW9uKCl7aWYoXCJzdHJpbmdcIj09PW4pe3ZhciBvLGE9MCxzPWIodGhpcyksdT10LGw9ZS5tYXRjaCh3KXx8W107d2hpbGUobz1sW2ErK10pdT1yP3U6IXMuaGFzQ2xhc3Mobyksc1t1P1wiYWRkQ2xhc3NcIjpcInJlbW92ZUNsYXNzXCJdKG8pfWVsc2Uobj09PWl8fFwiYm9vbGVhblwiPT09bikmJih0aGlzLmNsYXNzTmFtZSYmYi5fZGF0YSh0aGlzLFwiX19jbGFzc05hbWVfX1wiLHRoaXMuY2xhc3NOYW1lKSx0aGlzLmNsYXNzTmFtZT10aGlzLmNsYXNzTmFtZXx8ZT09PSExP1wiXCI6Yi5fZGF0YSh0aGlzLFwiX19jbGFzc05hbWVfX1wiKXx8XCJcIil9KX0saGFzQ2xhc3M6ZnVuY3Rpb24oZSl7dmFyIHQ9XCIgXCIrZStcIiBcIixuPTAscj10aGlzLmxlbmd0aDtmb3IoO3I+bjtuKyspaWYoMT09PXRoaXNbbl0ubm9kZVR5cGUmJihcIiBcIit0aGlzW25dLmNsYXNzTmFtZStcIiBcIikucmVwbGFjZShYLFwiIFwiKS5pbmRleE9mKHQpPj0wKXJldHVybiEwO3JldHVybiExfSx2YWw6ZnVuY3Rpb24oZSl7dmFyIG4scixpLG89dGhpc1swXTt7aWYoYXJndW1lbnRzLmxlbmd0aClyZXR1cm4gaT1iLmlzRnVuY3Rpb24oZSksdGhpcy5lYWNoKGZ1bmN0aW9uKG4pe3ZhciBvLGE9Yih0aGlzKTsxPT09dGhpcy5ub2RlVHlwZSYmKG89aT9lLmNhbGwodGhpcyxuLGEudmFsKCkpOmUsbnVsbD09bz9vPVwiXCI6XCJudW1iZXJcIj09dHlwZW9mIG8/bys9XCJcIjpiLmlzQXJyYXkobykmJihvPWIubWFwKG8sZnVuY3Rpb24oZSl7cmV0dXJuIG51bGw9PWU/XCJcIjplK1wiXCJ9KSkscj1iLnZhbEhvb2tzW3RoaXMudHlwZV18fGIudmFsSG9va3NbdGhpcy5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpXSxyJiZcInNldFwiaW4gciYmci5zZXQodGhpcyxvLFwidmFsdWVcIikhPT10fHwodGhpcy52YWx1ZT1vKSl9KTtpZihvKXJldHVybiByPWIudmFsSG9va3Nbby50eXBlXXx8Yi52YWxIb29rc1tvLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCldLHImJlwiZ2V0XCJpbiByJiYobj1yLmdldChvLFwidmFsdWVcIikpIT09dD9uOihuPW8udmFsdWUsXCJzdHJpbmdcIj09dHlwZW9mIG4/bi5yZXBsYWNlKFUsXCJcIik6bnVsbD09bj9cIlwiOm4pfX19KSxiLmV4dGVuZCh7dmFsSG9va3M6e29wdGlvbjp7Z2V0OmZ1bmN0aW9uKGUpe3ZhciB0PWUuYXR0cmlidXRlcy52YWx1ZTtyZXR1cm4hdHx8dC5zcGVjaWZpZWQ/ZS52YWx1ZTplLnRleHR9fSxzZWxlY3Q6e2dldDpmdW5jdGlvbihlKXt2YXIgdCxuLHI9ZS5vcHRpb25zLGk9ZS5zZWxlY3RlZEluZGV4LG89XCJzZWxlY3Qtb25lXCI9PT1lLnR5cGV8fDA+aSxhPW8/bnVsbDpbXSxzPW8/aSsxOnIubGVuZ3RoLHU9MD5pP3M6bz9pOjA7Zm9yKDtzPnU7dSsrKWlmKG49clt1XSwhKCFuLnNlbGVjdGVkJiZ1IT09aXx8KGIuc3VwcG9ydC5vcHREaXNhYmxlZD9uLmRpc2FibGVkOm51bGwhPT1uLmdldEF0dHJpYnV0ZShcImRpc2FibGVkXCIpKXx8bi5wYXJlbnROb2RlLmRpc2FibGVkJiZiLm5vZGVOYW1lKG4ucGFyZW50Tm9kZSxcIm9wdGdyb3VwXCIpKSl7aWYodD1iKG4pLnZhbCgpLG8pcmV0dXJuIHQ7YS5wdXNoKHQpfXJldHVybiBhfSxzZXQ6ZnVuY3Rpb24oZSx0KXt2YXIgbj1iLm1ha2VBcnJheSh0KTtyZXR1cm4gYihlKS5maW5kKFwib3B0aW9uXCIpLmVhY2goZnVuY3Rpb24oKXt0aGlzLnNlbGVjdGVkPWIuaW5BcnJheShiKHRoaXMpLnZhbCgpLG4pPj0wfSksbi5sZW5ndGh8fChlLnNlbGVjdGVkSW5kZXg9LTEpLG59fX0sYXR0cjpmdW5jdGlvbihlLG4scil7dmFyIG8sYSxzLHU9ZS5ub2RlVHlwZTtpZihlJiYzIT09dSYmOCE9PXUmJjIhPT11KXJldHVybiB0eXBlb2YgZS5nZXRBdHRyaWJ1dGU9PT1pP2IucHJvcChlLG4scik6KGE9MSE9PXV8fCFiLmlzWE1MRG9jKGUpLGEmJihuPW4udG9Mb3dlckNhc2UoKSxvPWIuYXR0ckhvb2tzW25dfHwoSi50ZXN0KG4pP3o6SSkpLHI9PT10P28mJmEmJlwiZ2V0XCJpbiBvJiZudWxsIT09KHM9by5nZXQoZSxuKSk/czoodHlwZW9mIGUuZ2V0QXR0cmlidXRlIT09aSYmKHM9ZS5nZXRBdHRyaWJ1dGUobikpLG51bGw9PXM/dDpzKTpudWxsIT09cj9vJiZhJiZcInNldFwiaW4gbyYmKHM9by5zZXQoZSxyLG4pKSE9PXQ/czooZS5zZXRBdHRyaWJ1dGUobixyK1wiXCIpLHIpOihiLnJlbW92ZUF0dHIoZSxuKSx0KSl9LHJlbW92ZUF0dHI6ZnVuY3Rpb24oZSx0KXt2YXIgbixyLGk9MCxvPXQmJnQubWF0Y2godyk7aWYobyYmMT09PWUubm9kZVR5cGUpd2hpbGUobj1vW2krK10pcj1iLnByb3BGaXhbbl18fG4sSi50ZXN0KG4pPyFRJiZHLnRlc3Qobik/ZVtiLmNhbWVsQ2FzZShcImRlZmF1bHQtXCIrbildPWVbcl09ITE6ZVtyXT0hMTpiLmF0dHIoZSxuLFwiXCIpLGUucmVtb3ZlQXR0cmlidXRlKFE/bjpyKX0sYXR0ckhvb2tzOnt0eXBlOntzZXQ6ZnVuY3Rpb24oZSx0KXtpZighYi5zdXBwb3J0LnJhZGlvVmFsdWUmJlwicmFkaW9cIj09PXQmJmIubm9kZU5hbWUoZSxcImlucHV0XCIpKXt2YXIgbj1lLnZhbHVlO3JldHVybiBlLnNldEF0dHJpYnV0ZShcInR5cGVcIix0KSxuJiYoZS52YWx1ZT1uKSx0fX19fSxwcm9wRml4Ont0YWJpbmRleDpcInRhYkluZGV4XCIscmVhZG9ubHk6XCJyZWFkT25seVwiLFwiZm9yXCI6XCJodG1sRm9yXCIsXCJjbGFzc1wiOlwiY2xhc3NOYW1lXCIsbWF4bGVuZ3RoOlwibWF4TGVuZ3RoXCIsY2VsbHNwYWNpbmc6XCJjZWxsU3BhY2luZ1wiLGNlbGxwYWRkaW5nOlwiY2VsbFBhZGRpbmdcIixyb3dzcGFuOlwicm93U3BhblwiLGNvbHNwYW46XCJjb2xTcGFuXCIsdXNlbWFwOlwidXNlTWFwXCIsZnJhbWVib3JkZXI6XCJmcmFtZUJvcmRlclwiLGNvbnRlbnRlZGl0YWJsZTpcImNvbnRlbnRFZGl0YWJsZVwifSxwcm9wOmZ1bmN0aW9uKGUsbixyKXt2YXIgaSxvLGEscz1lLm5vZGVUeXBlO2lmKGUmJjMhPT1zJiY4IT09cyYmMiE9PXMpcmV0dXJuIGE9MSE9PXN8fCFiLmlzWE1MRG9jKGUpLGEmJihuPWIucHJvcEZpeFtuXXx8bixvPWIucHJvcEhvb2tzW25dKSxyIT09dD9vJiZcInNldFwiaW4gbyYmKGk9by5zZXQoZSxyLG4pKSE9PXQ/aTplW25dPXI6byYmXCJnZXRcImluIG8mJm51bGwhPT0oaT1vLmdldChlLG4pKT9pOmVbbl19LHByb3BIb29rczp7dGFiSW5kZXg6e2dldDpmdW5jdGlvbihlKXt2YXIgbj1lLmdldEF0dHJpYnV0ZU5vZGUoXCJ0YWJpbmRleFwiKTtyZXR1cm4gbiYmbi5zcGVjaWZpZWQ/cGFyc2VJbnQobi52YWx1ZSwxMCk6Vi50ZXN0KGUubm9kZU5hbWUpfHxZLnRlc3QoZS5ub2RlTmFtZSkmJmUuaHJlZj8wOnR9fX19KSx6PXtnZXQ6ZnVuY3Rpb24oZSxuKXt2YXIgcj1iLnByb3AoZSxuKSxpPVwiYm9vbGVhblwiPT10eXBlb2YgciYmZS5nZXRBdHRyaWJ1dGUobiksbz1cImJvb2xlYW5cIj09dHlwZW9mIHI/SyYmUT9udWxsIT1pOkcudGVzdChuKT9lW2IuY2FtZWxDYXNlKFwiZGVmYXVsdC1cIituKV06ISFpOmUuZ2V0QXR0cmlidXRlTm9kZShuKTtyZXR1cm4gbyYmby52YWx1ZSE9PSExP24udG9Mb3dlckNhc2UoKTp0fSxzZXQ6ZnVuY3Rpb24oZSx0LG4pe3JldHVybiB0PT09ITE/Yi5yZW1vdmVBdHRyKGUsbik6SyYmUXx8IUcudGVzdChuKT9lLnNldEF0dHJpYnV0ZSghUSYmYi5wcm9wRml4W25dfHxuLG4pOmVbYi5jYW1lbENhc2UoXCJkZWZhdWx0LVwiK24pXT1lW25dPSEwLG59fSxLJiZRfHwoYi5hdHRySG9va3MudmFsdWU9e2dldDpmdW5jdGlvbihlLG4pe3ZhciByPWUuZ2V0QXR0cmlidXRlTm9kZShuKTtyZXR1cm4gYi5ub2RlTmFtZShlLFwiaW5wdXRcIik/ZS5kZWZhdWx0VmFsdWU6ciYmci5zcGVjaWZpZWQ/ci52YWx1ZTp0fSxzZXQ6ZnVuY3Rpb24oZSxuLHIpe3JldHVybiBiLm5vZGVOYW1lKGUsXCJpbnB1dFwiKT8oZS5kZWZhdWx0VmFsdWU9bix0KTpJJiZJLnNldChlLG4scil9fSksUXx8KEk9Yi52YWxIb29rcy5idXR0b249e2dldDpmdW5jdGlvbihlLG4pe3ZhciByPWUuZ2V0QXR0cmlidXRlTm9kZShuKTtyZXR1cm4gciYmKFwiaWRcIj09PW58fFwibmFtZVwiPT09bnx8XCJjb29yZHNcIj09PW4/XCJcIiE9PXIudmFsdWU6ci5zcGVjaWZpZWQpP3IudmFsdWU6dH0sc2V0OmZ1bmN0aW9uKGUsbixyKXt2YXIgaT1lLmdldEF0dHJpYnV0ZU5vZGUocik7cmV0dXJuIGl8fGUuc2V0QXR0cmlidXRlTm9kZShpPWUub3duZXJEb2N1bWVudC5jcmVhdGVBdHRyaWJ1dGUocikpLGkudmFsdWU9bis9XCJcIixcInZhbHVlXCI9PT1yfHxuPT09ZS5nZXRBdHRyaWJ1dGUocik/bjp0fX0sYi5hdHRySG9va3MuY29udGVudGVkaXRhYmxlPXtnZXQ6SS5nZXQsc2V0OmZ1bmN0aW9uKGUsdCxuKXtJLnNldChlLFwiXCI9PT10PyExOnQsbil9fSxiLmVhY2goW1wid2lkdGhcIixcImhlaWdodFwiXSxmdW5jdGlvbihlLG4pe2IuYXR0ckhvb2tzW25dPWIuZXh0ZW5kKGIuYXR0ckhvb2tzW25dLHtzZXQ6ZnVuY3Rpb24oZSxyKXtyZXR1cm5cIlwiPT09cj8oZS5zZXRBdHRyaWJ1dGUobixcImF1dG9cIikscik6dH19KX0pKSxiLnN1cHBvcnQuaHJlZk5vcm1hbGl6ZWR8fChiLmVhY2goW1wiaHJlZlwiLFwic3JjXCIsXCJ3aWR0aFwiLFwiaGVpZ2h0XCJdLGZ1bmN0aW9uKGUsbil7Yi5hdHRySG9va3Nbbl09Yi5leHRlbmQoYi5hdHRySG9va3Nbbl0se2dldDpmdW5jdGlvbihlKXt2YXIgcj1lLmdldEF0dHJpYnV0ZShuLDIpO3JldHVybiBudWxsPT1yP3Q6cn19KX0pLGIuZWFjaChbXCJocmVmXCIsXCJzcmNcIl0sZnVuY3Rpb24oZSx0KXtiLnByb3BIb29rc1t0XT17Z2V0OmZ1bmN0aW9uKGUpe3JldHVybiBlLmdldEF0dHJpYnV0ZSh0LDQpfX19KSksYi5zdXBwb3J0LnN0eWxlfHwoYi5hdHRySG9va3Muc3R5bGU9e2dldDpmdW5jdGlvbihlKXtyZXR1cm4gZS5zdHlsZS5jc3NUZXh0fHx0fSxzZXQ6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZS5zdHlsZS5jc3NUZXh0PXQrXCJcIn19KSxiLnN1cHBvcnQub3B0U2VsZWN0ZWR8fChiLnByb3BIb29rcy5zZWxlY3RlZD1iLmV4dGVuZChiLnByb3BIb29rcy5zZWxlY3RlZCx7Z2V0OmZ1bmN0aW9uKGUpe3ZhciB0PWUucGFyZW50Tm9kZTtyZXR1cm4gdCYmKHQuc2VsZWN0ZWRJbmRleCx0LnBhcmVudE5vZGUmJnQucGFyZW50Tm9kZS5zZWxlY3RlZEluZGV4KSxudWxsfX0pKSxiLnN1cHBvcnQuZW5jdHlwZXx8KGIucHJvcEZpeC5lbmN0eXBlPVwiZW5jb2RpbmdcIiksYi5zdXBwb3J0LmNoZWNrT258fGIuZWFjaChbXCJyYWRpb1wiLFwiY2hlY2tib3hcIl0sZnVuY3Rpb24oKXtiLnZhbEhvb2tzW3RoaXNdPXtnZXQ6ZnVuY3Rpb24oZSl7cmV0dXJuIG51bGw9PT1lLmdldEF0dHJpYnV0ZShcInZhbHVlXCIpP1wib25cIjplLnZhbHVlfX19KSxiLmVhY2goW1wicmFkaW9cIixcImNoZWNrYm94XCJdLGZ1bmN0aW9uKCl7Yi52YWxIb29rc1t0aGlzXT1iLmV4dGVuZChiLnZhbEhvb2tzW3RoaXNdLHtzZXQ6ZnVuY3Rpb24oZSxuKXtyZXR1cm4gYi5pc0FycmF5KG4pP2UuY2hlY2tlZD1iLmluQXJyYXkoYihlKS52YWwoKSxuKT49MDp0fX0pfSk7dmFyIFo9L14oPzppbnB1dHxzZWxlY3R8dGV4dGFyZWEpJC9pLGV0PS9ea2V5Lyx0dD0vXig/Om1vdXNlfGNvbnRleHRtZW51KXxjbGljay8sbnQ9L14oPzpmb2N1c2luZm9jdXN8Zm9jdXNvdXRibHVyKSQvLHJ0PS9eKFteLl0qKSg/OlxcLiguKyl8KSQvO2Z1bmN0aW9uIGl0KCl7cmV0dXJuITB9ZnVuY3Rpb24gb3QoKXtyZXR1cm4hMX1iLmV2ZW50PXtnbG9iYWw6e30sYWRkOmZ1bmN0aW9uKGUsbixyLG8sYSl7dmFyIHMsdSxsLGMscCxmLGQsaCxnLG0seSx2PWIuX2RhdGEoZSk7aWYodil7ci5oYW5kbGVyJiYoYz1yLHI9Yy5oYW5kbGVyLGE9Yy5zZWxlY3Rvciksci5ndWlkfHwoci5ndWlkPWIuZ3VpZCsrKSwodT12LmV2ZW50cyl8fCh1PXYuZXZlbnRzPXt9KSwoZj12LmhhbmRsZSl8fChmPXYuaGFuZGxlPWZ1bmN0aW9uKGUpe3JldHVybiB0eXBlb2YgYj09PWl8fGUmJmIuZXZlbnQudHJpZ2dlcmVkPT09ZS50eXBlP3Q6Yi5ldmVudC5kaXNwYXRjaC5hcHBseShmLmVsZW0sYXJndW1lbnRzKX0sZi5lbGVtPWUpLG49KG58fFwiXCIpLm1hdGNoKHcpfHxbXCJcIl0sbD1uLmxlbmd0aDt3aGlsZShsLS0pcz1ydC5leGVjKG5bbF0pfHxbXSxnPXk9c1sxXSxtPShzWzJdfHxcIlwiKS5zcGxpdChcIi5cIikuc29ydCgpLHA9Yi5ldmVudC5zcGVjaWFsW2ddfHx7fSxnPShhP3AuZGVsZWdhdGVUeXBlOnAuYmluZFR5cGUpfHxnLHA9Yi5ldmVudC5zcGVjaWFsW2ddfHx7fSxkPWIuZXh0ZW5kKHt0eXBlOmcsb3JpZ1R5cGU6eSxkYXRhOm8saGFuZGxlcjpyLGd1aWQ6ci5ndWlkLHNlbGVjdG9yOmEsbmVlZHNDb250ZXh0OmEmJmIuZXhwci5tYXRjaC5uZWVkc0NvbnRleHQudGVzdChhKSxuYW1lc3BhY2U6bS5qb2luKFwiLlwiKX0sYyksKGg9dVtnXSl8fChoPXVbZ109W10saC5kZWxlZ2F0ZUNvdW50PTAscC5zZXR1cCYmcC5zZXR1cC5jYWxsKGUsbyxtLGYpIT09ITF8fChlLmFkZEV2ZW50TGlzdGVuZXI/ZS5hZGRFdmVudExpc3RlbmVyKGcsZiwhMSk6ZS5hdHRhY2hFdmVudCYmZS5hdHRhY2hFdmVudChcIm9uXCIrZyxmKSkpLHAuYWRkJiYocC5hZGQuY2FsbChlLGQpLGQuaGFuZGxlci5ndWlkfHwoZC5oYW5kbGVyLmd1aWQ9ci5ndWlkKSksYT9oLnNwbGljZShoLmRlbGVnYXRlQ291bnQrKywwLGQpOmgucHVzaChkKSxiLmV2ZW50Lmdsb2JhbFtnXT0hMDtlPW51bGx9fSxyZW1vdmU6ZnVuY3Rpb24oZSx0LG4scixpKXt2YXIgbyxhLHMsdSxsLGMscCxmLGQsaCxnLG09Yi5oYXNEYXRhKGUpJiZiLl9kYXRhKGUpO2lmKG0mJihjPW0uZXZlbnRzKSl7dD0odHx8XCJcIikubWF0Y2godyl8fFtcIlwiXSxsPXQubGVuZ3RoO3doaWxlKGwtLSlpZihzPXJ0LmV4ZWModFtsXSl8fFtdLGQ9Zz1zWzFdLGg9KHNbMl18fFwiXCIpLnNwbGl0KFwiLlwiKS5zb3J0KCksZCl7cD1iLmV2ZW50LnNwZWNpYWxbZF18fHt9LGQ9KHI/cC5kZWxlZ2F0ZVR5cGU6cC5iaW5kVHlwZSl8fGQsZj1jW2RdfHxbXSxzPXNbMl0mJlJlZ0V4cChcIihefFxcXFwuKVwiK2guam9pbihcIlxcXFwuKD86LipcXFxcLnwpXCIpK1wiKFxcXFwufCQpXCIpLHU9bz1mLmxlbmd0aDt3aGlsZShvLS0pYT1mW29dLCFpJiZnIT09YS5vcmlnVHlwZXx8biYmbi5ndWlkIT09YS5ndWlkfHxzJiYhcy50ZXN0KGEubmFtZXNwYWNlKXx8ciYmciE9PWEuc2VsZWN0b3ImJihcIioqXCIhPT1yfHwhYS5zZWxlY3Rvcil8fChmLnNwbGljZShvLDEpLGEuc2VsZWN0b3ImJmYuZGVsZWdhdGVDb3VudC0tLHAucmVtb3ZlJiZwLnJlbW92ZS5jYWxsKGUsYSkpO3UmJiFmLmxlbmd0aCYmKHAudGVhcmRvd24mJnAudGVhcmRvd24uY2FsbChlLGgsbS5oYW5kbGUpIT09ITF8fGIucmVtb3ZlRXZlbnQoZSxkLG0uaGFuZGxlKSxkZWxldGUgY1tkXSl9ZWxzZSBmb3IoZCBpbiBjKWIuZXZlbnQucmVtb3ZlKGUsZCt0W2xdLG4sciwhMCk7Yi5pc0VtcHR5T2JqZWN0KGMpJiYoZGVsZXRlIG0uaGFuZGxlLGIuX3JlbW92ZURhdGEoZSxcImV2ZW50c1wiKSl9fSx0cmlnZ2VyOmZ1bmN0aW9uKG4scixpLGEpe3ZhciBzLHUsbCxjLHAsZixkLGg9W2l8fG9dLGc9eS5jYWxsKG4sXCJ0eXBlXCIpP24udHlwZTpuLG09eS5jYWxsKG4sXCJuYW1lc3BhY2VcIik/bi5uYW1lc3BhY2Uuc3BsaXQoXCIuXCIpOltdO2lmKGw9Zj1pPWl8fG8sMyE9PWkubm9kZVR5cGUmJjghPT1pLm5vZGVUeXBlJiYhbnQudGVzdChnK2IuZXZlbnQudHJpZ2dlcmVkKSYmKGcuaW5kZXhPZihcIi5cIik+PTAmJihtPWcuc3BsaXQoXCIuXCIpLGc9bS5zaGlmdCgpLG0uc29ydCgpKSx1PTA+Zy5pbmRleE9mKFwiOlwiKSYmXCJvblwiK2csbj1uW2IuZXhwYW5kb10/bjpuZXcgYi5FdmVudChnLFwib2JqZWN0XCI9PXR5cGVvZiBuJiZuKSxuLmlzVHJpZ2dlcj0hMCxuLm5hbWVzcGFjZT1tLmpvaW4oXCIuXCIpLG4ubmFtZXNwYWNlX3JlPW4ubmFtZXNwYWNlP1JlZ0V4cChcIihefFxcXFwuKVwiK20uam9pbihcIlxcXFwuKD86LipcXFxcLnwpXCIpK1wiKFxcXFwufCQpXCIpOm51bGwsbi5yZXN1bHQ9dCxuLnRhcmdldHx8KG4udGFyZ2V0PWkpLHI9bnVsbD09cj9bbl06Yi5tYWtlQXJyYXkocixbbl0pLHA9Yi5ldmVudC5zcGVjaWFsW2ddfHx7fSxhfHwhcC50cmlnZ2VyfHxwLnRyaWdnZXIuYXBwbHkoaSxyKSE9PSExKSl7aWYoIWEmJiFwLm5vQnViYmxlJiYhYi5pc1dpbmRvdyhpKSl7Zm9yKGM9cC5kZWxlZ2F0ZVR5cGV8fGcsbnQudGVzdChjK2cpfHwobD1sLnBhcmVudE5vZGUpO2w7bD1sLnBhcmVudE5vZGUpaC5wdXNoKGwpLGY9bDtmPT09KGkub3duZXJEb2N1bWVudHx8bykmJmgucHVzaChmLmRlZmF1bHRWaWV3fHxmLnBhcmVudFdpbmRvd3x8ZSl9ZD0wO3doaWxlKChsPWhbZCsrXSkmJiFuLmlzUHJvcGFnYXRpb25TdG9wcGVkKCkpbi50eXBlPWQ+MT9jOnAuYmluZFR5cGV8fGcscz0oYi5fZGF0YShsLFwiZXZlbnRzXCIpfHx7fSlbbi50eXBlXSYmYi5fZGF0YShsLFwiaGFuZGxlXCIpLHMmJnMuYXBwbHkobCxyKSxzPXUmJmxbdV0scyYmYi5hY2NlcHREYXRhKGwpJiZzLmFwcGx5JiZzLmFwcGx5KGwscik9PT0hMSYmbi5wcmV2ZW50RGVmYXVsdCgpO2lmKG4udHlwZT1nLCEoYXx8bi5pc0RlZmF1bHRQcmV2ZW50ZWQoKXx8cC5fZGVmYXVsdCYmcC5fZGVmYXVsdC5hcHBseShpLm93bmVyRG9jdW1lbnQscikhPT0hMXx8XCJjbGlja1wiPT09ZyYmYi5ub2RlTmFtZShpLFwiYVwiKXx8IWIuYWNjZXB0RGF0YShpKXx8IXV8fCFpW2ddfHxiLmlzV2luZG93KGkpKSl7Zj1pW3VdLGYmJihpW3VdPW51bGwpLGIuZXZlbnQudHJpZ2dlcmVkPWc7dHJ5e2lbZ10oKX1jYXRjaCh2KXt9Yi5ldmVudC50cmlnZ2VyZWQ9dCxmJiYoaVt1XT1mKX1yZXR1cm4gbi5yZXN1bHR9fSxkaXNwYXRjaDpmdW5jdGlvbihlKXtlPWIuZXZlbnQuZml4KGUpO3ZhciBuLHIsaSxvLGEscz1bXSx1PWguY2FsbChhcmd1bWVudHMpLGw9KGIuX2RhdGEodGhpcyxcImV2ZW50c1wiKXx8e30pW2UudHlwZV18fFtdLGM9Yi5ldmVudC5zcGVjaWFsW2UudHlwZV18fHt9O2lmKHVbMF09ZSxlLmRlbGVnYXRlVGFyZ2V0PXRoaXMsIWMucHJlRGlzcGF0Y2h8fGMucHJlRGlzcGF0Y2guY2FsbCh0aGlzLGUpIT09ITEpe3M9Yi5ldmVudC5oYW5kbGVycy5jYWxsKHRoaXMsZSxsKSxuPTA7d2hpbGUoKG89c1tuKytdKSYmIWUuaXNQcm9wYWdhdGlvblN0b3BwZWQoKSl7ZS5jdXJyZW50VGFyZ2V0PW8uZWxlbSxhPTA7d2hpbGUoKGk9by5oYW5kbGVyc1thKytdKSYmIWUuaXNJbW1lZGlhdGVQcm9wYWdhdGlvblN0b3BwZWQoKSkoIWUubmFtZXNwYWNlX3JlfHxlLm5hbWVzcGFjZV9yZS50ZXN0KGkubmFtZXNwYWNlKSkmJihlLmhhbmRsZU9iaj1pLGUuZGF0YT1pLmRhdGEscj0oKGIuZXZlbnQuc3BlY2lhbFtpLm9yaWdUeXBlXXx8e30pLmhhbmRsZXx8aS5oYW5kbGVyKS5hcHBseShvLmVsZW0sdSksciE9PXQmJihlLnJlc3VsdD1yKT09PSExJiYoZS5wcmV2ZW50RGVmYXVsdCgpLGUuc3RvcFByb3BhZ2F0aW9uKCkpKX1yZXR1cm4gYy5wb3N0RGlzcGF0Y2gmJmMucG9zdERpc3BhdGNoLmNhbGwodGhpcyxlKSxlLnJlc3VsdH19LGhhbmRsZXJzOmZ1bmN0aW9uKGUsbil7dmFyIHIsaSxvLGEscz1bXSx1PW4uZGVsZWdhdGVDb3VudCxsPWUudGFyZ2V0O2lmKHUmJmwubm9kZVR5cGUmJighZS5idXR0b258fFwiY2xpY2tcIiE9PWUudHlwZSkpZm9yKDtsIT10aGlzO2w9bC5wYXJlbnROb2RlfHx0aGlzKWlmKDE9PT1sLm5vZGVUeXBlJiYobC5kaXNhYmxlZCE9PSEwfHxcImNsaWNrXCIhPT1lLnR5cGUpKXtmb3Iobz1bXSxhPTA7dT5hO2ErKylpPW5bYV0scj1pLnNlbGVjdG9yK1wiIFwiLG9bcl09PT10JiYob1tyXT1pLm5lZWRzQ29udGV4dD9iKHIsdGhpcykuaW5kZXgobCk+PTA6Yi5maW5kKHIsdGhpcyxudWxsLFtsXSkubGVuZ3RoKSxvW3JdJiZvLnB1c2goaSk7by5sZW5ndGgmJnMucHVzaCh7ZWxlbTpsLGhhbmRsZXJzOm99KX1yZXR1cm4gbi5sZW5ndGg+dSYmcy5wdXNoKHtlbGVtOnRoaXMsaGFuZGxlcnM6bi5zbGljZSh1KX0pLHN9LGZpeDpmdW5jdGlvbihlKXtpZihlW2IuZXhwYW5kb10pcmV0dXJuIGU7dmFyIHQsbixyLGk9ZS50eXBlLGE9ZSxzPXRoaXMuZml4SG9va3NbaV07c3x8KHRoaXMuZml4SG9va3NbaV09cz10dC50ZXN0KGkpP3RoaXMubW91c2VIb29rczpldC50ZXN0KGkpP3RoaXMua2V5SG9va3M6e30pLHI9cy5wcm9wcz90aGlzLnByb3BzLmNvbmNhdChzLnByb3BzKTp0aGlzLnByb3BzLGU9bmV3IGIuRXZlbnQoYSksdD1yLmxlbmd0aDt3aGlsZSh0LS0pbj1yW3RdLGVbbl09YVtuXTtyZXR1cm4gZS50YXJnZXR8fChlLnRhcmdldD1hLnNyY0VsZW1lbnR8fG8pLDM9PT1lLnRhcmdldC5ub2RlVHlwZSYmKGUudGFyZ2V0PWUudGFyZ2V0LnBhcmVudE5vZGUpLGUubWV0YUtleT0hIWUubWV0YUtleSxzLmZpbHRlcj9zLmZpbHRlcihlLGEpOmV9LHByb3BzOlwiYWx0S2V5IGJ1YmJsZXMgY2FuY2VsYWJsZSBjdHJsS2V5IGN1cnJlbnRUYXJnZXQgZXZlbnRQaGFzZSBtZXRhS2V5IHJlbGF0ZWRUYXJnZXQgc2hpZnRLZXkgdGFyZ2V0IHRpbWVTdGFtcCB2aWV3IHdoaWNoXCIuc3BsaXQoXCIgXCIpLGZpeEhvb2tzOnt9LGtleUhvb2tzOntwcm9wczpcImNoYXIgY2hhckNvZGUga2V5IGtleUNvZGVcIi5zcGxpdChcIiBcIiksZmlsdGVyOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIG51bGw9PWUud2hpY2gmJihlLndoaWNoPW51bGwhPXQuY2hhckNvZGU/dC5jaGFyQ29kZTp0LmtleUNvZGUpLGV9fSxtb3VzZUhvb2tzOntwcm9wczpcImJ1dHRvbiBidXR0b25zIGNsaWVudFggY2xpZW50WSBmcm9tRWxlbWVudCBvZmZzZXRYIG9mZnNldFkgcGFnZVggcGFnZVkgc2NyZWVuWCBzY3JlZW5ZIHRvRWxlbWVudFwiLnNwbGl0KFwiIFwiKSxmaWx0ZXI6ZnVuY3Rpb24oZSxuKXt2YXIgcixpLGEscz1uLmJ1dHRvbix1PW4uZnJvbUVsZW1lbnQ7cmV0dXJuIG51bGw9PWUucGFnZVgmJm51bGwhPW4uY2xpZW50WCYmKGk9ZS50YXJnZXQub3duZXJEb2N1bWVudHx8byxhPWkuZG9jdW1lbnRFbGVtZW50LHI9aS5ib2R5LGUucGFnZVg9bi5jbGllbnRYKyhhJiZhLnNjcm9sbExlZnR8fHImJnIuc2Nyb2xsTGVmdHx8MCktKGEmJmEuY2xpZW50TGVmdHx8ciYmci5jbGllbnRMZWZ0fHwwKSxlLnBhZ2VZPW4uY2xpZW50WSsoYSYmYS5zY3JvbGxUb3B8fHImJnIuc2Nyb2xsVG9wfHwwKS0oYSYmYS5jbGllbnRUb3B8fHImJnIuY2xpZW50VG9wfHwwKSksIWUucmVsYXRlZFRhcmdldCYmdSYmKGUucmVsYXRlZFRhcmdldD11PT09ZS50YXJnZXQ/bi50b0VsZW1lbnQ6dSksZS53aGljaHx8cz09PXR8fChlLndoaWNoPTEmcz8xOjImcz8zOjQmcz8yOjApLGV9fSxzcGVjaWFsOntsb2FkOntub0J1YmJsZTohMH0sY2xpY2s6e3RyaWdnZXI6ZnVuY3Rpb24oKXtyZXR1cm4gYi5ub2RlTmFtZSh0aGlzLFwiaW5wdXRcIikmJlwiY2hlY2tib3hcIj09PXRoaXMudHlwZSYmdGhpcy5jbGljaz8odGhpcy5jbGljaygpLCExKTp0fX0sZm9jdXM6e3RyaWdnZXI6ZnVuY3Rpb24oKXtpZih0aGlzIT09by5hY3RpdmVFbGVtZW50JiZ0aGlzLmZvY3VzKXRyeXtyZXR1cm4gdGhpcy5mb2N1cygpLCExfWNhdGNoKGUpe319LGRlbGVnYXRlVHlwZTpcImZvY3VzaW5cIn0sYmx1cjp7dHJpZ2dlcjpmdW5jdGlvbigpe3JldHVybiB0aGlzPT09by5hY3RpdmVFbGVtZW50JiZ0aGlzLmJsdXI/KHRoaXMuYmx1cigpLCExKTp0fSxkZWxlZ2F0ZVR5cGU6XCJmb2N1c291dFwifSxiZWZvcmV1bmxvYWQ6e3Bvc3REaXNwYXRjaDpmdW5jdGlvbihlKXtlLnJlc3VsdCE9PXQmJihlLm9yaWdpbmFsRXZlbnQucmV0dXJuVmFsdWU9ZS5yZXN1bHQpfX19LHNpbXVsYXRlOmZ1bmN0aW9uKGUsdCxuLHIpe3ZhciBpPWIuZXh0ZW5kKG5ldyBiLkV2ZW50LG4se3R5cGU6ZSxpc1NpbXVsYXRlZDohMCxvcmlnaW5hbEV2ZW50Ont9fSk7cj9iLmV2ZW50LnRyaWdnZXIoaSxudWxsLHQpOmIuZXZlbnQuZGlzcGF0Y2guY2FsbCh0LGkpLGkuaXNEZWZhdWx0UHJldmVudGVkKCkmJm4ucHJldmVudERlZmF1bHQoKX19LGIucmVtb3ZlRXZlbnQ9by5yZW1vdmVFdmVudExpc3RlbmVyP2Z1bmN0aW9uKGUsdCxuKXtlLnJlbW92ZUV2ZW50TGlzdGVuZXImJmUucmVtb3ZlRXZlbnRMaXN0ZW5lcih0LG4sITEpfTpmdW5jdGlvbihlLHQsbil7dmFyIHI9XCJvblwiK3Q7ZS5kZXRhY2hFdmVudCYmKHR5cGVvZiBlW3JdPT09aSYmKGVbcl09bnVsbCksZS5kZXRhY2hFdmVudChyLG4pKX0sYi5FdmVudD1mdW5jdGlvbihlLG4pe3JldHVybiB0aGlzIGluc3RhbmNlb2YgYi5FdmVudD8oZSYmZS50eXBlPyh0aGlzLm9yaWdpbmFsRXZlbnQ9ZSx0aGlzLnR5cGU9ZS50eXBlLHRoaXMuaXNEZWZhdWx0UHJldmVudGVkPWUuZGVmYXVsdFByZXZlbnRlZHx8ZS5yZXR1cm5WYWx1ZT09PSExfHxlLmdldFByZXZlbnREZWZhdWx0JiZlLmdldFByZXZlbnREZWZhdWx0KCk/aXQ6b3QpOnRoaXMudHlwZT1lLG4mJmIuZXh0ZW5kKHRoaXMsbiksdGhpcy50aW1lU3RhbXA9ZSYmZS50aW1lU3RhbXB8fGIubm93KCksdGhpc1tiLmV4cGFuZG9dPSEwLHQpOm5ldyBiLkV2ZW50KGUsbil9LGIuRXZlbnQucHJvdG90eXBlPXtpc0RlZmF1bHRQcmV2ZW50ZWQ6b3QsaXNQcm9wYWdhdGlvblN0b3BwZWQ6b3QsaXNJbW1lZGlhdGVQcm9wYWdhdGlvblN0b3BwZWQ6b3QscHJldmVudERlZmF1bHQ6ZnVuY3Rpb24oKXt2YXIgZT10aGlzLm9yaWdpbmFsRXZlbnQ7dGhpcy5pc0RlZmF1bHRQcmV2ZW50ZWQ9aXQsZSYmKGUucHJldmVudERlZmF1bHQ/ZS5wcmV2ZW50RGVmYXVsdCgpOmUucmV0dXJuVmFsdWU9ITEpfSxzdG9wUHJvcGFnYXRpb246ZnVuY3Rpb24oKXt2YXIgZT10aGlzLm9yaWdpbmFsRXZlbnQ7dGhpcy5pc1Byb3BhZ2F0aW9uU3RvcHBlZD1pdCxlJiYoZS5zdG9wUHJvcGFnYXRpb24mJmUuc3RvcFByb3BhZ2F0aW9uKCksZS5jYW5jZWxCdWJibGU9ITApfSxzdG9wSW1tZWRpYXRlUHJvcGFnYXRpb246ZnVuY3Rpb24oKXt0aGlzLmlzSW1tZWRpYXRlUHJvcGFnYXRpb25TdG9wcGVkPWl0LHRoaXMuc3RvcFByb3BhZ2F0aW9uKCl9fSxiLmVhY2goe21vdXNlZW50ZXI6XCJtb3VzZW92ZXJcIixtb3VzZWxlYXZlOlwibW91c2VvdXRcIn0sZnVuY3Rpb24oZSx0KXtiLmV2ZW50LnNwZWNpYWxbZV09e2RlbGVnYXRlVHlwZTp0LGJpbmRUeXBlOnQsaGFuZGxlOmZ1bmN0aW9uKGUpe3ZhciBuLHI9dGhpcyxpPWUucmVsYXRlZFRhcmdldCxvPWUuaGFuZGxlT2JqO1xucmV0dXJuKCFpfHxpIT09ciYmIWIuY29udGFpbnMocixpKSkmJihlLnR5cGU9by5vcmlnVHlwZSxuPW8uaGFuZGxlci5hcHBseSh0aGlzLGFyZ3VtZW50cyksZS50eXBlPXQpLG59fX0pLGIuc3VwcG9ydC5zdWJtaXRCdWJibGVzfHwoYi5ldmVudC5zcGVjaWFsLnN1Ym1pdD17c2V0dXA6ZnVuY3Rpb24oKXtyZXR1cm4gYi5ub2RlTmFtZSh0aGlzLFwiZm9ybVwiKT8hMTooYi5ldmVudC5hZGQodGhpcyxcImNsaWNrLl9zdWJtaXQga2V5cHJlc3MuX3N1Ym1pdFwiLGZ1bmN0aW9uKGUpe3ZhciBuPWUudGFyZ2V0LHI9Yi5ub2RlTmFtZShuLFwiaW5wdXRcIil8fGIubm9kZU5hbWUobixcImJ1dHRvblwiKT9uLmZvcm06dDtyJiYhYi5fZGF0YShyLFwic3VibWl0QnViYmxlc1wiKSYmKGIuZXZlbnQuYWRkKHIsXCJzdWJtaXQuX3N1Ym1pdFwiLGZ1bmN0aW9uKGUpe2UuX3N1Ym1pdF9idWJibGU9ITB9KSxiLl9kYXRhKHIsXCJzdWJtaXRCdWJibGVzXCIsITApKX0pLHQpfSxwb3N0RGlzcGF0Y2g6ZnVuY3Rpb24oZSl7ZS5fc3VibWl0X2J1YmJsZSYmKGRlbGV0ZSBlLl9zdWJtaXRfYnViYmxlLHRoaXMucGFyZW50Tm9kZSYmIWUuaXNUcmlnZ2VyJiZiLmV2ZW50LnNpbXVsYXRlKFwic3VibWl0XCIsdGhpcy5wYXJlbnROb2RlLGUsITApKX0sdGVhcmRvd246ZnVuY3Rpb24oKXtyZXR1cm4gYi5ub2RlTmFtZSh0aGlzLFwiZm9ybVwiKT8hMTooYi5ldmVudC5yZW1vdmUodGhpcyxcIi5fc3VibWl0XCIpLHQpfX0pLGIuc3VwcG9ydC5jaGFuZ2VCdWJibGVzfHwoYi5ldmVudC5zcGVjaWFsLmNoYW5nZT17c2V0dXA6ZnVuY3Rpb24oKXtyZXR1cm4gWi50ZXN0KHRoaXMubm9kZU5hbWUpPygoXCJjaGVja2JveFwiPT09dGhpcy50eXBlfHxcInJhZGlvXCI9PT10aGlzLnR5cGUpJiYoYi5ldmVudC5hZGQodGhpcyxcInByb3BlcnR5Y2hhbmdlLl9jaGFuZ2VcIixmdW5jdGlvbihlKXtcImNoZWNrZWRcIj09PWUub3JpZ2luYWxFdmVudC5wcm9wZXJ0eU5hbWUmJih0aGlzLl9qdXN0X2NoYW5nZWQ9ITApfSksYi5ldmVudC5hZGQodGhpcyxcImNsaWNrLl9jaGFuZ2VcIixmdW5jdGlvbihlKXt0aGlzLl9qdXN0X2NoYW5nZWQmJiFlLmlzVHJpZ2dlciYmKHRoaXMuX2p1c3RfY2hhbmdlZD0hMSksYi5ldmVudC5zaW11bGF0ZShcImNoYW5nZVwiLHRoaXMsZSwhMCl9KSksITEpOihiLmV2ZW50LmFkZCh0aGlzLFwiYmVmb3JlYWN0aXZhdGUuX2NoYW5nZVwiLGZ1bmN0aW9uKGUpe3ZhciB0PWUudGFyZ2V0O1oudGVzdCh0Lm5vZGVOYW1lKSYmIWIuX2RhdGEodCxcImNoYW5nZUJ1YmJsZXNcIikmJihiLmV2ZW50LmFkZCh0LFwiY2hhbmdlLl9jaGFuZ2VcIixmdW5jdGlvbihlKXshdGhpcy5wYXJlbnROb2RlfHxlLmlzU2ltdWxhdGVkfHxlLmlzVHJpZ2dlcnx8Yi5ldmVudC5zaW11bGF0ZShcImNoYW5nZVwiLHRoaXMucGFyZW50Tm9kZSxlLCEwKX0pLGIuX2RhdGEodCxcImNoYW5nZUJ1YmJsZXNcIiwhMCkpfSksdCl9LGhhbmRsZTpmdW5jdGlvbihlKXt2YXIgbj1lLnRhcmdldDtyZXR1cm4gdGhpcyE9PW58fGUuaXNTaW11bGF0ZWR8fGUuaXNUcmlnZ2VyfHxcInJhZGlvXCIhPT1uLnR5cGUmJlwiY2hlY2tib3hcIiE9PW4udHlwZT9lLmhhbmRsZU9iai5oYW5kbGVyLmFwcGx5KHRoaXMsYXJndW1lbnRzKTp0fSx0ZWFyZG93bjpmdW5jdGlvbigpe3JldHVybiBiLmV2ZW50LnJlbW92ZSh0aGlzLFwiLl9jaGFuZ2VcIiksIVoudGVzdCh0aGlzLm5vZGVOYW1lKX19KSxiLnN1cHBvcnQuZm9jdXNpbkJ1YmJsZXN8fGIuZWFjaCh7Zm9jdXM6XCJmb2N1c2luXCIsYmx1cjpcImZvY3Vzb3V0XCJ9LGZ1bmN0aW9uKGUsdCl7dmFyIG49MCxyPWZ1bmN0aW9uKGUpe2IuZXZlbnQuc2ltdWxhdGUodCxlLnRhcmdldCxiLmV2ZW50LmZpeChlKSwhMCl9O2IuZXZlbnQuc3BlY2lhbFt0XT17c2V0dXA6ZnVuY3Rpb24oKXswPT09bisrJiZvLmFkZEV2ZW50TGlzdGVuZXIoZSxyLCEwKX0sdGVhcmRvd246ZnVuY3Rpb24oKXswPT09LS1uJiZvLnJlbW92ZUV2ZW50TGlzdGVuZXIoZSxyLCEwKX19fSksYi5mbi5leHRlbmQoe29uOmZ1bmN0aW9uKGUsbixyLGksbyl7dmFyIGEscztpZihcIm9iamVjdFwiPT10eXBlb2YgZSl7XCJzdHJpbmdcIiE9dHlwZW9mIG4mJihyPXJ8fG4sbj10KTtmb3IoYSBpbiBlKXRoaXMub24oYSxuLHIsZVthXSxvKTtyZXR1cm4gdGhpc31pZihudWxsPT1yJiZudWxsPT1pPyhpPW4scj1uPXQpOm51bGw9PWkmJihcInN0cmluZ1wiPT10eXBlb2Ygbj8oaT1yLHI9dCk6KGk9cixyPW4sbj10KSksaT09PSExKWk9b3Q7ZWxzZSBpZighaSlyZXR1cm4gdGhpcztyZXR1cm4gMT09PW8mJihzPWksaT1mdW5jdGlvbihlKXtyZXR1cm4gYigpLm9mZihlKSxzLmFwcGx5KHRoaXMsYXJndW1lbnRzKX0saS5ndWlkPXMuZ3VpZHx8KHMuZ3VpZD1iLmd1aWQrKykpLHRoaXMuZWFjaChmdW5jdGlvbigpe2IuZXZlbnQuYWRkKHRoaXMsZSxpLHIsbil9KX0sb25lOmZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiB0aGlzLm9uKGUsdCxuLHIsMSl9LG9mZjpmdW5jdGlvbihlLG4scil7dmFyIGksbztpZihlJiZlLnByZXZlbnREZWZhdWx0JiZlLmhhbmRsZU9iailyZXR1cm4gaT1lLmhhbmRsZU9iaixiKGUuZGVsZWdhdGVUYXJnZXQpLm9mZihpLm5hbWVzcGFjZT9pLm9yaWdUeXBlK1wiLlwiK2kubmFtZXNwYWNlOmkub3JpZ1R5cGUsaS5zZWxlY3RvcixpLmhhbmRsZXIpLHRoaXM7aWYoXCJvYmplY3RcIj09dHlwZW9mIGUpe2ZvcihvIGluIGUpdGhpcy5vZmYobyxuLGVbb10pO3JldHVybiB0aGlzfXJldHVybihuPT09ITF8fFwiZnVuY3Rpb25cIj09dHlwZW9mIG4pJiYocj1uLG49dCkscj09PSExJiYocj1vdCksdGhpcy5lYWNoKGZ1bmN0aW9uKCl7Yi5ldmVudC5yZW1vdmUodGhpcyxlLHIsbil9KX0sYmluZDpmdW5jdGlvbihlLHQsbil7cmV0dXJuIHRoaXMub24oZSxudWxsLHQsbil9LHVuYmluZDpmdW5jdGlvbihlLHQpe3JldHVybiB0aGlzLm9mZihlLG51bGwsdCl9LGRlbGVnYXRlOmZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiB0aGlzLm9uKHQsZSxuLHIpfSx1bmRlbGVnYXRlOmZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gMT09PWFyZ3VtZW50cy5sZW5ndGg/dGhpcy5vZmYoZSxcIioqXCIpOnRoaXMub2ZmKHQsZXx8XCIqKlwiLG4pfSx0cmlnZ2VyOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbigpe2IuZXZlbnQudHJpZ2dlcihlLHQsdGhpcyl9KX0sdHJpZ2dlckhhbmRsZXI6ZnVuY3Rpb24oZSxuKXt2YXIgcj10aGlzWzBdO3JldHVybiByP2IuZXZlbnQudHJpZ2dlcihlLG4sciwhMCk6dH19KSxmdW5jdGlvbihlLHQpe3ZhciBuLHIsaSxvLGEscyx1LGwsYyxwLGYsZCxoLGcsbSx5LHYseD1cInNpenpsZVwiKy1uZXcgRGF0ZSx3PWUuZG9jdW1lbnQsVD17fSxOPTAsQz0wLGs9aXQoKSxFPWl0KCksUz1pdCgpLEE9dHlwZW9mIHQsaj0xPDwzMSxEPVtdLEw9RC5wb3AsSD1ELnB1c2gscT1ELnNsaWNlLE09RC5pbmRleE9mfHxmdW5jdGlvbihlKXt2YXIgdD0wLG49dGhpcy5sZW5ndGg7Zm9yKDtuPnQ7dCsrKWlmKHRoaXNbdF09PT1lKXJldHVybiB0O3JldHVybi0xfSxfPVwiW1xcXFx4MjBcXFxcdFxcXFxyXFxcXG5cXFxcZl1cIixGPVwiKD86XFxcXFxcXFwufFtcXFxcdy1dfFteXFxcXHgwMC1cXFxceGEwXSkrXCIsTz1GLnJlcGxhY2UoXCJ3XCIsXCJ3I1wiKSxCPVwiKFsqXiR8IX5dPz0pXCIsUD1cIlxcXFxbXCIrXytcIiooXCIrRitcIilcIitfK1wiKig/OlwiK0IrXytcIiooPzooWydcXFwiXSkoKD86XFxcXFxcXFwufFteXFxcXFxcXFxdKSo/KVxcXFwzfChcIitPK1wiKXwpfClcIitfK1wiKlxcXFxdXCIsUj1cIjooXCIrRitcIikoPzpcXFxcKCgoWydcXFwiXSkoKD86XFxcXFxcXFwufFteXFxcXFxcXFxdKSo/KVxcXFwzfCgoPzpcXFxcXFxcXC58W15cXFxcXFxcXCgpW1xcXFxdXXxcIitQLnJlcGxhY2UoMyw4KStcIikqKXwuKilcXFxcKXwpXCIsVz1SZWdFeHAoXCJeXCIrXytcIit8KCg/Ol58W15cXFxcXFxcXF0pKD86XFxcXFxcXFwuKSopXCIrXytcIiskXCIsXCJnXCIpLCQ9UmVnRXhwKFwiXlwiK18rXCIqLFwiK18rXCIqXCIpLEk9UmVnRXhwKFwiXlwiK18rXCIqKFtcXFxceDIwXFxcXHRcXFxcclxcXFxuXFxcXGY+K35dKVwiK18rXCIqXCIpLHo9UmVnRXhwKFIpLFg9UmVnRXhwKFwiXlwiK08rXCIkXCIpLFU9e0lEOlJlZ0V4cChcIl4jKFwiK0YrXCIpXCIpLENMQVNTOlJlZ0V4cChcIl5cXFxcLihcIitGK1wiKVwiKSxOQU1FOlJlZ0V4cChcIl5cXFxcW25hbWU9WydcXFwiXT8oXCIrRitcIilbJ1xcXCJdP1xcXFxdXCIpLFRBRzpSZWdFeHAoXCJeKFwiK0YucmVwbGFjZShcIndcIixcIncqXCIpK1wiKVwiKSxBVFRSOlJlZ0V4cChcIl5cIitQKSxQU0VVRE86UmVnRXhwKFwiXlwiK1IpLENISUxEOlJlZ0V4cChcIl46KG9ubHl8Zmlyc3R8bGFzdHxudGh8bnRoLWxhc3QpLShjaGlsZHxvZi10eXBlKSg/OlxcXFwoXCIrXytcIiooZXZlbnxvZGR8KChbKy1dfCkoXFxcXGQqKW58KVwiK18rXCIqKD86KFsrLV18KVwiK18rXCIqKFxcXFxkKyl8KSlcIitfK1wiKlxcXFwpfClcIixcImlcIiksbmVlZHNDb250ZXh0OlJlZ0V4cChcIl5cIitfK1wiKls+K35dfDooZXZlbnxvZGR8ZXF8Z3R8bHR8bnRofGZpcnN0fGxhc3QpKD86XFxcXChcIitfK1wiKigoPzotXFxcXGQpP1xcXFxkKilcIitfK1wiKlxcXFwpfCkoPz1bXi1dfCQpXCIsXCJpXCIpfSxWPS9bXFx4MjBcXHRcXHJcXG5cXGZdKlsrfl0vLFk9L15bXntdK1xce1xccypcXFtuYXRpdmUgY29kZS8sSj0vXig/OiMoW1xcdy1dKyl8KFxcdyspfFxcLihbXFx3LV0rKSkkLyxHPS9eKD86aW5wdXR8c2VsZWN0fHRleHRhcmVhfGJ1dHRvbikkL2ksUT0vXmhcXGQkL2ksSz0vJ3xcXFxcL2csWj0vXFw9W1xceDIwXFx0XFxyXFxuXFxmXSooW14nXCJcXF1dKilbXFx4MjBcXHRcXHJcXG5cXGZdKlxcXS9nLGV0PS9cXFxcKFtcXGRhLWZBLUZdezEsNn1bXFx4MjBcXHRcXHJcXG5cXGZdP3wuKS9nLHR0PWZ1bmN0aW9uKGUsdCl7dmFyIG49XCIweFwiK3QtNjU1MzY7cmV0dXJuIG4hPT1uP3Q6MD5uP1N0cmluZy5mcm9tQ2hhckNvZGUobis2NTUzNik6U3RyaW5nLmZyb21DaGFyQ29kZSg1NTI5NnxuPj4xMCw1NjMyMHwxMDIzJm4pfTt0cnl7cS5jYWxsKHcuZG9jdW1lbnRFbGVtZW50LmNoaWxkTm9kZXMsMClbMF0ubm9kZVR5cGV9Y2F0Y2gobnQpe3E9ZnVuY3Rpb24oZSl7dmFyIHQsbj1bXTt3aGlsZSh0PXRoaXNbZSsrXSluLnB1c2godCk7cmV0dXJuIG59fWZ1bmN0aW9uIHJ0KGUpe3JldHVybiBZLnRlc3QoZStcIlwiKX1mdW5jdGlvbiBpdCgpe3ZhciBlLHQ9W107cmV0dXJuIGU9ZnVuY3Rpb24obixyKXtyZXR1cm4gdC5wdXNoKG4rPVwiIFwiKT5pLmNhY2hlTGVuZ3RoJiZkZWxldGUgZVt0LnNoaWZ0KCldLGVbbl09cn19ZnVuY3Rpb24gb3QoZSl7cmV0dXJuIGVbeF09ITAsZX1mdW5jdGlvbiBhdChlKXt2YXIgdD1wLmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7dHJ5e3JldHVybiBlKHQpfWNhdGNoKG4pe3JldHVybiExfWZpbmFsbHl7dD1udWxsfX1mdW5jdGlvbiBzdChlLHQsbixyKXt2YXIgaSxvLGEscyx1LGwsZixnLG0sdjtpZigodD90Lm93bmVyRG9jdW1lbnR8fHQ6dykhPT1wJiZjKHQpLHQ9dHx8cCxuPW58fFtdLCFlfHxcInN0cmluZ1wiIT10eXBlb2YgZSlyZXR1cm4gbjtpZigxIT09KHM9dC5ub2RlVHlwZSkmJjkhPT1zKXJldHVybltdO2lmKCFkJiYhcil7aWYoaT1KLmV4ZWMoZSkpaWYoYT1pWzFdKXtpZig5PT09cyl7aWYobz10LmdldEVsZW1lbnRCeUlkKGEpLCFvfHwhby5wYXJlbnROb2RlKXJldHVybiBuO2lmKG8uaWQ9PT1hKXJldHVybiBuLnB1c2gobyksbn1lbHNlIGlmKHQub3duZXJEb2N1bWVudCYmKG89dC5vd25lckRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGEpKSYmeSh0LG8pJiZvLmlkPT09YSlyZXR1cm4gbi5wdXNoKG8pLG59ZWxzZXtpZihpWzJdKXJldHVybiBILmFwcGx5KG4scS5jYWxsKHQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoZSksMCkpLG47aWYoKGE9aVszXSkmJlQuZ2V0QnlDbGFzc05hbWUmJnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSlyZXR1cm4gSC5hcHBseShuLHEuY2FsbCh0LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoYSksMCkpLG59aWYoVC5xc2EmJiFoLnRlc3QoZSkpe2lmKGY9ITAsZz14LG09dCx2PTk9PT1zJiZlLDE9PT1zJiZcIm9iamVjdFwiIT09dC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpKXtsPWZ0KGUpLChmPXQuZ2V0QXR0cmlidXRlKFwiaWRcIikpP2c9Zi5yZXBsYWNlKEssXCJcXFxcJCZcIik6dC5zZXRBdHRyaWJ1dGUoXCJpZFwiLGcpLGc9XCJbaWQ9J1wiK2crXCInXSBcIix1PWwubGVuZ3RoO3doaWxlKHUtLSlsW3VdPWcrZHQobFt1XSk7bT1WLnRlc3QoZSkmJnQucGFyZW50Tm9kZXx8dCx2PWwuam9pbihcIixcIil9aWYodil0cnl7cmV0dXJuIEguYXBwbHkobixxLmNhbGwobS5xdWVyeVNlbGVjdG9yQWxsKHYpLDApKSxufWNhdGNoKGIpe31maW5hbGx5e2Z8fHQucmVtb3ZlQXR0cmlidXRlKFwiaWRcIil9fX1yZXR1cm4gd3QoZS5yZXBsYWNlKFcsXCIkMVwiKSx0LG4scil9YT1zdC5pc1hNTD1mdW5jdGlvbihlKXt2YXIgdD1lJiYoZS5vd25lckRvY3VtZW50fHxlKS5kb2N1bWVudEVsZW1lbnQ7cmV0dXJuIHQ/XCJIVE1MXCIhPT10Lm5vZGVOYW1lOiExfSxjPXN0LnNldERvY3VtZW50PWZ1bmN0aW9uKGUpe3ZhciBuPWU/ZS5vd25lckRvY3VtZW50fHxlOnc7cmV0dXJuIG4hPT1wJiY5PT09bi5ub2RlVHlwZSYmbi5kb2N1bWVudEVsZW1lbnQ/KHA9bixmPW4uZG9jdW1lbnRFbGVtZW50LGQ9YShuKSxULnRhZ05hbWVOb0NvbW1lbnRzPWF0KGZ1bmN0aW9uKGUpe3JldHVybiBlLmFwcGVuZENoaWxkKG4uY3JlYXRlQ29tbWVudChcIlwiKSksIWUuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCIqXCIpLmxlbmd0aH0pLFQuYXR0cmlidXRlcz1hdChmdW5jdGlvbihlKXtlLmlubmVySFRNTD1cIjxzZWxlY3Q+PC9zZWxlY3Q+XCI7dmFyIHQ9dHlwZW9mIGUubGFzdENoaWxkLmdldEF0dHJpYnV0ZShcIm11bHRpcGxlXCIpO3JldHVyblwiYm9vbGVhblwiIT09dCYmXCJzdHJpbmdcIiE9PXR9KSxULmdldEJ5Q2xhc3NOYW1lPWF0KGZ1bmN0aW9uKGUpe3JldHVybiBlLmlubmVySFRNTD1cIjxkaXYgY2xhc3M9J2hpZGRlbiBlJz48L2Rpdj48ZGl2IGNsYXNzPSdoaWRkZW4nPjwvZGl2PlwiLGUuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSYmZS5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwiZVwiKS5sZW5ndGg/KGUubGFzdENoaWxkLmNsYXNzTmFtZT1cImVcIiwyPT09ZS5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwiZVwiKS5sZW5ndGgpOiExfSksVC5nZXRCeU5hbWU9YXQoZnVuY3Rpb24oZSl7ZS5pZD14KzAsZS5pbm5lckhUTUw9XCI8YSBuYW1lPSdcIit4K1wiJz48L2E+PGRpdiBuYW1lPSdcIit4K1wiJz48L2Rpdj5cIixmLmluc2VydEJlZm9yZShlLGYuZmlyc3RDaGlsZCk7dmFyIHQ9bi5nZXRFbGVtZW50c0J5TmFtZSYmbi5nZXRFbGVtZW50c0J5TmFtZSh4KS5sZW5ndGg9PT0yK24uZ2V0RWxlbWVudHNCeU5hbWUoeCswKS5sZW5ndGg7cmV0dXJuIFQuZ2V0SWROb3ROYW1lPSFuLmdldEVsZW1lbnRCeUlkKHgpLGYucmVtb3ZlQ2hpbGQoZSksdH0pLGkuYXR0ckhhbmRsZT1hdChmdW5jdGlvbihlKXtyZXR1cm4gZS5pbm5lckhUTUw9XCI8YSBocmVmPScjJz48L2E+XCIsZS5maXJzdENoaWxkJiZ0eXBlb2YgZS5maXJzdENoaWxkLmdldEF0dHJpYnV0ZSE9PUEmJlwiI1wiPT09ZS5maXJzdENoaWxkLmdldEF0dHJpYnV0ZShcImhyZWZcIil9KT97fTp7aHJlZjpmdW5jdGlvbihlKXtyZXR1cm4gZS5nZXRBdHRyaWJ1dGUoXCJocmVmXCIsMil9LHR5cGU6ZnVuY3Rpb24oZSl7cmV0dXJuIGUuZ2V0QXR0cmlidXRlKFwidHlwZVwiKX19LFQuZ2V0SWROb3ROYW1lPyhpLmZpbmQuSUQ9ZnVuY3Rpb24oZSx0KXtpZih0eXBlb2YgdC5nZXRFbGVtZW50QnlJZCE9PUEmJiFkKXt2YXIgbj10LmdldEVsZW1lbnRCeUlkKGUpO3JldHVybiBuJiZuLnBhcmVudE5vZGU/W25dOltdfX0saS5maWx0ZXIuSUQ9ZnVuY3Rpb24oZSl7dmFyIHQ9ZS5yZXBsYWNlKGV0LHR0KTtyZXR1cm4gZnVuY3Rpb24oZSl7cmV0dXJuIGUuZ2V0QXR0cmlidXRlKFwiaWRcIik9PT10fX0pOihpLmZpbmQuSUQ9ZnVuY3Rpb24oZSxuKXtpZih0eXBlb2Ygbi5nZXRFbGVtZW50QnlJZCE9PUEmJiFkKXt2YXIgcj1uLmdldEVsZW1lbnRCeUlkKGUpO3JldHVybiByP3IuaWQ9PT1lfHx0eXBlb2Ygci5nZXRBdHRyaWJ1dGVOb2RlIT09QSYmci5nZXRBdHRyaWJ1dGVOb2RlKFwiaWRcIikudmFsdWU9PT1lP1tyXTp0OltdfX0saS5maWx0ZXIuSUQ9ZnVuY3Rpb24oZSl7dmFyIHQ9ZS5yZXBsYWNlKGV0LHR0KTtyZXR1cm4gZnVuY3Rpb24oZSl7dmFyIG49dHlwZW9mIGUuZ2V0QXR0cmlidXRlTm9kZSE9PUEmJmUuZ2V0QXR0cmlidXRlTm9kZShcImlkXCIpO3JldHVybiBuJiZuLnZhbHVlPT09dH19KSxpLmZpbmQuVEFHPVQudGFnTmFtZU5vQ29tbWVudHM/ZnVuY3Rpb24oZSxuKXtyZXR1cm4gdHlwZW9mIG4uZ2V0RWxlbWVudHNCeVRhZ05hbWUhPT1BP24uZ2V0RWxlbWVudHNCeVRhZ05hbWUoZSk6dH06ZnVuY3Rpb24oZSx0KXt2YXIgbixyPVtdLGk9MCxvPXQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoZSk7aWYoXCIqXCI9PT1lKXt3aGlsZShuPW9baSsrXSkxPT09bi5ub2RlVHlwZSYmci5wdXNoKG4pO3JldHVybiByfXJldHVybiBvfSxpLmZpbmQuTkFNRT1ULmdldEJ5TmFtZSYmZnVuY3Rpb24oZSxuKXtyZXR1cm4gdHlwZW9mIG4uZ2V0RWxlbWVudHNCeU5hbWUhPT1BP24uZ2V0RWxlbWVudHNCeU5hbWUobmFtZSk6dH0saS5maW5kLkNMQVNTPVQuZ2V0QnlDbGFzc05hbWUmJmZ1bmN0aW9uKGUsbil7cmV0dXJuIHR5cGVvZiBuLmdldEVsZW1lbnRzQnlDbGFzc05hbWU9PT1BfHxkP3Q6bi5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKGUpfSxnPVtdLGg9W1wiOmZvY3VzXCJdLChULnFzYT1ydChuLnF1ZXJ5U2VsZWN0b3JBbGwpKSYmKGF0KGZ1bmN0aW9uKGUpe2UuaW5uZXJIVE1MPVwiPHNlbGVjdD48b3B0aW9uIHNlbGVjdGVkPScnPjwvb3B0aW9uPjwvc2VsZWN0PlwiLGUucXVlcnlTZWxlY3RvckFsbChcIltzZWxlY3RlZF1cIikubGVuZ3RofHxoLnB1c2goXCJcXFxcW1wiK18rXCIqKD86Y2hlY2tlZHxkaXNhYmxlZHxpc21hcHxtdWx0aXBsZXxyZWFkb25seXxzZWxlY3RlZHx2YWx1ZSlcIiksZS5xdWVyeVNlbGVjdG9yQWxsKFwiOmNoZWNrZWRcIikubGVuZ3RofHxoLnB1c2goXCI6Y2hlY2tlZFwiKX0pLGF0KGZ1bmN0aW9uKGUpe2UuaW5uZXJIVE1MPVwiPGlucHV0IHR5cGU9J2hpZGRlbicgaT0nJy8+XCIsZS5xdWVyeVNlbGVjdG9yQWxsKFwiW2lePScnXVwiKS5sZW5ndGgmJmgucHVzaChcIlsqXiRdPVwiK18rXCIqKD86XFxcIlxcXCJ8JycpXCIpLGUucXVlcnlTZWxlY3RvckFsbChcIjplbmFibGVkXCIpLmxlbmd0aHx8aC5wdXNoKFwiOmVuYWJsZWRcIixcIjpkaXNhYmxlZFwiKSxlLnF1ZXJ5U2VsZWN0b3JBbGwoXCIqLDp4XCIpLGgucHVzaChcIiwuKjpcIil9KSksKFQubWF0Y2hlc1NlbGVjdG9yPXJ0KG09Zi5tYXRjaGVzU2VsZWN0b3J8fGYubW96TWF0Y2hlc1NlbGVjdG9yfHxmLndlYmtpdE1hdGNoZXNTZWxlY3Rvcnx8Zi5vTWF0Y2hlc1NlbGVjdG9yfHxmLm1zTWF0Y2hlc1NlbGVjdG9yKSkmJmF0KGZ1bmN0aW9uKGUpe1QuZGlzY29ubmVjdGVkTWF0Y2g9bS5jYWxsKGUsXCJkaXZcIiksbS5jYWxsKGUsXCJbcyE9JyddOnhcIiksZy5wdXNoKFwiIT1cIixSKX0pLGg9UmVnRXhwKGguam9pbihcInxcIikpLGc9UmVnRXhwKGcuam9pbihcInxcIikpLHk9cnQoZi5jb250YWlucyl8fGYuY29tcGFyZURvY3VtZW50UG9zaXRpb24/ZnVuY3Rpb24oZSx0KXt2YXIgbj05PT09ZS5ub2RlVHlwZT9lLmRvY3VtZW50RWxlbWVudDplLHI9dCYmdC5wYXJlbnROb2RlO3JldHVybiBlPT09cnx8ISghcnx8MSE9PXIubm9kZVR5cGV8fCEobi5jb250YWlucz9uLmNvbnRhaW5zKHIpOmUuY29tcGFyZURvY3VtZW50UG9zaXRpb24mJjE2JmUuY29tcGFyZURvY3VtZW50UG9zaXRpb24ocikpKX06ZnVuY3Rpb24oZSx0KXtpZih0KXdoaWxlKHQ9dC5wYXJlbnROb2RlKWlmKHQ9PT1lKXJldHVybiEwO3JldHVybiExfSx2PWYuY29tcGFyZURvY3VtZW50UG9zaXRpb24/ZnVuY3Rpb24oZSx0KXt2YXIgcjtyZXR1cm4gZT09PXQ/KHU9ITAsMCk6KHI9dC5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbiYmZS5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbiYmZS5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbih0KSk/MSZyfHxlLnBhcmVudE5vZGUmJjExPT09ZS5wYXJlbnROb2RlLm5vZGVUeXBlP2U9PT1ufHx5KHcsZSk/LTE6dD09PW58fHkodyx0KT8xOjA6NCZyPy0xOjE6ZS5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbj8tMToxfTpmdW5jdGlvbihlLHQpe3ZhciByLGk9MCxvPWUucGFyZW50Tm9kZSxhPXQucGFyZW50Tm9kZSxzPVtlXSxsPVt0XTtpZihlPT09dClyZXR1cm4gdT0hMCwwO2lmKCFvfHwhYSlyZXR1cm4gZT09PW4/LTE6dD09PW4/MTpvPy0xOmE/MTowO2lmKG89PT1hKXJldHVybiB1dChlLHQpO3I9ZTt3aGlsZShyPXIucGFyZW50Tm9kZSlzLnVuc2hpZnQocik7cj10O3doaWxlKHI9ci5wYXJlbnROb2RlKWwudW5zaGlmdChyKTt3aGlsZShzW2ldPT09bFtpXSlpKys7cmV0dXJuIGk/dXQoc1tpXSxsW2ldKTpzW2ldPT09dz8tMTpsW2ldPT09dz8xOjB9LHU9ITEsWzAsMF0uc29ydCh2KSxULmRldGVjdER1cGxpY2F0ZXM9dSxwKTpwfSxzdC5tYXRjaGVzPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIHN0KGUsbnVsbCxudWxsLHQpfSxzdC5tYXRjaGVzU2VsZWN0b3I9ZnVuY3Rpb24oZSx0KXtpZigoZS5vd25lckRvY3VtZW50fHxlKSE9PXAmJmMoZSksdD10LnJlcGxhY2UoWixcIj0nJDEnXVwiKSwhKCFULm1hdGNoZXNTZWxlY3Rvcnx8ZHx8ZyYmZy50ZXN0KHQpfHxoLnRlc3QodCkpKXRyeXt2YXIgbj1tLmNhbGwoZSx0KTtpZihufHxULmRpc2Nvbm5lY3RlZE1hdGNofHxlLmRvY3VtZW50JiYxMSE9PWUuZG9jdW1lbnQubm9kZVR5cGUpcmV0dXJuIG59Y2F0Y2gocil7fXJldHVybiBzdCh0LHAsbnVsbCxbZV0pLmxlbmd0aD4wfSxzdC5jb250YWlucz1mdW5jdGlvbihlLHQpe3JldHVybihlLm93bmVyRG9jdW1lbnR8fGUpIT09cCYmYyhlKSx5KGUsdCl9LHN0LmF0dHI9ZnVuY3Rpb24oZSx0KXt2YXIgbjtyZXR1cm4oZS5vd25lckRvY3VtZW50fHxlKSE9PXAmJmMoZSksZHx8KHQ9dC50b0xvd2VyQ2FzZSgpKSwobj1pLmF0dHJIYW5kbGVbdF0pP24oZSk6ZHx8VC5hdHRyaWJ1dGVzP2UuZ2V0QXR0cmlidXRlKHQpOigobj1lLmdldEF0dHJpYnV0ZU5vZGUodCkpfHxlLmdldEF0dHJpYnV0ZSh0KSkmJmVbdF09PT0hMD90Om4mJm4uc3BlY2lmaWVkP24udmFsdWU6bnVsbH0sc3QuZXJyb3I9ZnVuY3Rpb24oZSl7dGhyb3cgRXJyb3IoXCJTeW50YXggZXJyb3IsIHVucmVjb2duaXplZCBleHByZXNzaW9uOiBcIitlKX0sc3QudW5pcXVlU29ydD1mdW5jdGlvbihlKXt2YXIgdCxuPVtdLHI9MSxpPTA7aWYodT0hVC5kZXRlY3REdXBsaWNhdGVzLGUuc29ydCh2KSx1KXtmb3IoO3Q9ZVtyXTtyKyspdD09PWVbci0xXSYmKGk9bi5wdXNoKHIpKTt3aGlsZShpLS0pZS5zcGxpY2UobltpXSwxKX1yZXR1cm4gZX07ZnVuY3Rpb24gdXQoZSx0KXt2YXIgbj10JiZlLHI9biYmKH50LnNvdXJjZUluZGV4fHxqKS0ofmUuc291cmNlSW5kZXh8fGopO2lmKHIpcmV0dXJuIHI7aWYobil3aGlsZShuPW4ubmV4dFNpYmxpbmcpaWYobj09PXQpcmV0dXJuLTE7cmV0dXJuIGU/MTotMX1mdW5jdGlvbiBsdChlKXtyZXR1cm4gZnVuY3Rpb24odCl7dmFyIG49dC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpO3JldHVyblwiaW5wdXRcIj09PW4mJnQudHlwZT09PWV9fWZ1bmN0aW9uIGN0KGUpe3JldHVybiBmdW5jdGlvbih0KXt2YXIgbj10Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7cmV0dXJuKFwiaW5wdXRcIj09PW58fFwiYnV0dG9uXCI9PT1uKSYmdC50eXBlPT09ZX19ZnVuY3Rpb24gcHQoZSl7cmV0dXJuIG90KGZ1bmN0aW9uKHQpe3JldHVybiB0PSt0LG90KGZ1bmN0aW9uKG4scil7dmFyIGksbz1lKFtdLG4ubGVuZ3RoLHQpLGE9by5sZW5ndGg7d2hpbGUoYS0tKW5baT1vW2FdXSYmKG5baV09IShyW2ldPW5baV0pKX0pfSl9bz1zdC5nZXRUZXh0PWZ1bmN0aW9uKGUpe3ZhciB0LG49XCJcIixyPTAsaT1lLm5vZGVUeXBlO2lmKGkpe2lmKDE9PT1pfHw5PT09aXx8MTE9PT1pKXtpZihcInN0cmluZ1wiPT10eXBlb2YgZS50ZXh0Q29udGVudClyZXR1cm4gZS50ZXh0Q29udGVudDtmb3IoZT1lLmZpcnN0Q2hpbGQ7ZTtlPWUubmV4dFNpYmxpbmcpbis9byhlKX1lbHNlIGlmKDM9PT1pfHw0PT09aSlyZXR1cm4gZS5ub2RlVmFsdWV9ZWxzZSBmb3IoO3Q9ZVtyXTtyKyspbis9byh0KTtyZXR1cm4gbn0saT1zdC5zZWxlY3RvcnM9e2NhY2hlTGVuZ3RoOjUwLGNyZWF0ZVBzZXVkbzpvdCxtYXRjaDpVLGZpbmQ6e30scmVsYXRpdmU6e1wiPlwiOntkaXI6XCJwYXJlbnROb2RlXCIsZmlyc3Q6ITB9LFwiIFwiOntkaXI6XCJwYXJlbnROb2RlXCJ9LFwiK1wiOntkaXI6XCJwcmV2aW91c1NpYmxpbmdcIixmaXJzdDohMH0sXCJ+XCI6e2RpcjpcInByZXZpb3VzU2libGluZ1wifX0scHJlRmlsdGVyOntBVFRSOmZ1bmN0aW9uKGUpe3JldHVybiBlWzFdPWVbMV0ucmVwbGFjZShldCx0dCksZVszXT0oZVs0XXx8ZVs1XXx8XCJcIikucmVwbGFjZShldCx0dCksXCJ+PVwiPT09ZVsyXSYmKGVbM109XCIgXCIrZVszXStcIiBcIiksZS5zbGljZSgwLDQpfSxDSElMRDpmdW5jdGlvbihlKXtyZXR1cm4gZVsxXT1lWzFdLnRvTG93ZXJDYXNlKCksXCJudGhcIj09PWVbMV0uc2xpY2UoMCwzKT8oZVszXXx8c3QuZXJyb3IoZVswXSksZVs0XT0rKGVbNF0/ZVs1XSsoZVs2XXx8MSk6MiooXCJldmVuXCI9PT1lWzNdfHxcIm9kZFwiPT09ZVszXSkpLGVbNV09KyhlWzddK2VbOF18fFwib2RkXCI9PT1lWzNdKSk6ZVszXSYmc3QuZXJyb3IoZVswXSksZX0sUFNFVURPOmZ1bmN0aW9uKGUpe3ZhciB0LG49IWVbNV0mJmVbMl07cmV0dXJuIFUuQ0hJTEQudGVzdChlWzBdKT9udWxsOihlWzRdP2VbMl09ZVs0XTpuJiZ6LnRlc3QobikmJih0PWZ0KG4sITApKSYmKHQ9bi5pbmRleE9mKFwiKVwiLG4ubGVuZ3RoLXQpLW4ubGVuZ3RoKSYmKGVbMF09ZVswXS5zbGljZSgwLHQpLGVbMl09bi5zbGljZSgwLHQpKSxlLnNsaWNlKDAsMykpfX0sZmlsdGVyOntUQUc6ZnVuY3Rpb24oZSl7cmV0dXJuXCIqXCI9PT1lP2Z1bmN0aW9uKCl7cmV0dXJuITB9OihlPWUucmVwbGFjZShldCx0dCkudG9Mb3dlckNhc2UoKSxmdW5jdGlvbih0KXtyZXR1cm4gdC5ub2RlTmFtZSYmdC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpPT09ZX0pfSxDTEFTUzpmdW5jdGlvbihlKXt2YXIgdD1rW2UrXCIgXCJdO3JldHVybiB0fHwodD1SZWdFeHAoXCIoXnxcIitfK1wiKVwiK2UrXCIoXCIrXytcInwkKVwiKSkmJmsoZSxmdW5jdGlvbihlKXtyZXR1cm4gdC50ZXN0KGUuY2xhc3NOYW1lfHx0eXBlb2YgZS5nZXRBdHRyaWJ1dGUhPT1BJiZlLmdldEF0dHJpYnV0ZShcImNsYXNzXCIpfHxcIlwiKX0pfSxBVFRSOmZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZnVuY3Rpb24ocil7dmFyIGk9c3QuYXR0cihyLGUpO3JldHVybiBudWxsPT1pP1wiIT1cIj09PXQ6dD8oaSs9XCJcIixcIj1cIj09PXQ/aT09PW46XCIhPVwiPT09dD9pIT09bjpcIl49XCI9PT10P24mJjA9PT1pLmluZGV4T2Yobik6XCIqPVwiPT09dD9uJiZpLmluZGV4T2Yobik+LTE6XCIkPVwiPT09dD9uJiZpLnNsaWNlKC1uLmxlbmd0aCk9PT1uOlwifj1cIj09PXQ/KFwiIFwiK2krXCIgXCIpLmluZGV4T2Yobik+LTE6XCJ8PVwiPT09dD9pPT09bnx8aS5zbGljZSgwLG4ubGVuZ3RoKzEpPT09bitcIi1cIjohMSk6ITB9fSxDSElMRDpmdW5jdGlvbihlLHQsbixyLGkpe3ZhciBvPVwibnRoXCIhPT1lLnNsaWNlKDAsMyksYT1cImxhc3RcIiE9PWUuc2xpY2UoLTQpLHM9XCJvZi10eXBlXCI9PT10O3JldHVybiAxPT09ciYmMD09PWk/ZnVuY3Rpb24oZSl7cmV0dXJuISFlLnBhcmVudE5vZGV9OmZ1bmN0aW9uKHQsbix1KXt2YXIgbCxjLHAsZixkLGgsZz1vIT09YT9cIm5leHRTaWJsaW5nXCI6XCJwcmV2aW91c1NpYmxpbmdcIixtPXQucGFyZW50Tm9kZSx5PXMmJnQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSx2PSF1JiYhcztpZihtKXtpZihvKXt3aGlsZShnKXtwPXQ7d2hpbGUocD1wW2ddKWlmKHM/cC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpPT09eToxPT09cC5ub2RlVHlwZSlyZXR1cm4hMTtoPWc9XCJvbmx5XCI9PT1lJiYhaCYmXCJuZXh0U2libGluZ1wifXJldHVybiEwfWlmKGg9W2E/bS5maXJzdENoaWxkOm0ubGFzdENoaWxkXSxhJiZ2KXtjPW1beF18fChtW3hdPXt9KSxsPWNbZV18fFtdLGQ9bFswXT09PU4mJmxbMV0sZj1sWzBdPT09TiYmbFsyXSxwPWQmJm0uY2hpbGROb2Rlc1tkXTt3aGlsZShwPSsrZCYmcCYmcFtnXXx8KGY9ZD0wKXx8aC5wb3AoKSlpZigxPT09cC5ub2RlVHlwZSYmKytmJiZwPT09dCl7Y1tlXT1bTixkLGZdO2JyZWFrfX1lbHNlIGlmKHYmJihsPSh0W3hdfHwodFt4XT17fSkpW2VdKSYmbFswXT09PU4pZj1sWzFdO2Vsc2Ugd2hpbGUocD0rK2QmJnAmJnBbZ118fChmPWQ9MCl8fGgucG9wKCkpaWYoKHM/cC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpPT09eToxPT09cC5ub2RlVHlwZSkmJisrZiYmKHYmJigocFt4XXx8KHBbeF09e30pKVtlXT1bTixmXSkscD09PXQpKWJyZWFrO3JldHVybiBmLT1pLGY9PT1yfHwwPT09ZiVyJiZmL3I+PTB9fX0sUFNFVURPOmZ1bmN0aW9uKGUsdCl7dmFyIG4scj1pLnBzZXVkb3NbZV18fGkuc2V0RmlsdGVyc1tlLnRvTG93ZXJDYXNlKCldfHxzdC5lcnJvcihcInVuc3VwcG9ydGVkIHBzZXVkbzogXCIrZSk7cmV0dXJuIHJbeF0/cih0KTpyLmxlbmd0aD4xPyhuPVtlLGUsXCJcIix0XSxpLnNldEZpbHRlcnMuaGFzT3duUHJvcGVydHkoZS50b0xvd2VyQ2FzZSgpKT9vdChmdW5jdGlvbihlLG4pe3ZhciBpLG89cihlLHQpLGE9by5sZW5ndGg7d2hpbGUoYS0tKWk9TS5jYWxsKGUsb1thXSksZVtpXT0hKG5baV09b1thXSl9KTpmdW5jdGlvbihlKXtyZXR1cm4gcihlLDAsbil9KTpyfX0scHNldWRvczp7bm90Om90KGZ1bmN0aW9uKGUpe3ZhciB0PVtdLG49W10scj1zKGUucmVwbGFjZShXLFwiJDFcIikpO3JldHVybiByW3hdP290KGZ1bmN0aW9uKGUsdCxuLGkpe3ZhciBvLGE9cihlLG51bGwsaSxbXSkscz1lLmxlbmd0aDt3aGlsZShzLS0pKG89YVtzXSkmJihlW3NdPSEodFtzXT1vKSl9KTpmdW5jdGlvbihlLGksbyl7cmV0dXJuIHRbMF09ZSxyKHQsbnVsbCxvLG4pLCFuLnBvcCgpfX0pLGhhczpvdChmdW5jdGlvbihlKXtyZXR1cm4gZnVuY3Rpb24odCl7cmV0dXJuIHN0KGUsdCkubGVuZ3RoPjB9fSksY29udGFpbnM6b3QoZnVuY3Rpb24oZSl7cmV0dXJuIGZ1bmN0aW9uKHQpe3JldHVybih0LnRleHRDb250ZW50fHx0LmlubmVyVGV4dHx8byh0KSkuaW5kZXhPZihlKT4tMX19KSxsYW5nOm90KGZ1bmN0aW9uKGUpe3JldHVybiBYLnRlc3QoZXx8XCJcIil8fHN0LmVycm9yKFwidW5zdXBwb3J0ZWQgbGFuZzogXCIrZSksZT1lLnJlcGxhY2UoZXQsdHQpLnRvTG93ZXJDYXNlKCksZnVuY3Rpb24odCl7dmFyIG47ZG8gaWYobj1kP3QuZ2V0QXR0cmlidXRlKFwieG1sOmxhbmdcIil8fHQuZ2V0QXR0cmlidXRlKFwibGFuZ1wiKTp0LmxhbmcpcmV0dXJuIG49bi50b0xvd2VyQ2FzZSgpLG49PT1lfHwwPT09bi5pbmRleE9mKGUrXCItXCIpO3doaWxlKCh0PXQucGFyZW50Tm9kZSkmJjE9PT10Lm5vZGVUeXBlKTtyZXR1cm4hMX19KSx0YXJnZXQ6ZnVuY3Rpb24odCl7dmFyIG49ZS5sb2NhdGlvbiYmZS5sb2NhdGlvbi5oYXNoO3JldHVybiBuJiZuLnNsaWNlKDEpPT09dC5pZH0scm9vdDpmdW5jdGlvbihlKXtyZXR1cm4gZT09PWZ9LGZvY3VzOmZ1bmN0aW9uKGUpe3JldHVybiBlPT09cC5hY3RpdmVFbGVtZW50JiYoIXAuaGFzRm9jdXN8fHAuaGFzRm9jdXMoKSkmJiEhKGUudHlwZXx8ZS5ocmVmfHx+ZS50YWJJbmRleCl9LGVuYWJsZWQ6ZnVuY3Rpb24oZSl7cmV0dXJuIGUuZGlzYWJsZWQ9PT0hMX0sZGlzYWJsZWQ6ZnVuY3Rpb24oZSl7cmV0dXJuIGUuZGlzYWJsZWQ9PT0hMH0sY2hlY2tlZDpmdW5jdGlvbihlKXt2YXIgdD1lLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7cmV0dXJuXCJpbnB1dFwiPT09dCYmISFlLmNoZWNrZWR8fFwib3B0aW9uXCI9PT10JiYhIWUuc2VsZWN0ZWR9LHNlbGVjdGVkOmZ1bmN0aW9uKGUpe3JldHVybiBlLnBhcmVudE5vZGUmJmUucGFyZW50Tm9kZS5zZWxlY3RlZEluZGV4LGUuc2VsZWN0ZWQ9PT0hMH0sZW1wdHk6ZnVuY3Rpb24oZSl7Zm9yKGU9ZS5maXJzdENoaWxkO2U7ZT1lLm5leHRTaWJsaW5nKWlmKGUubm9kZU5hbWU+XCJAXCJ8fDM9PT1lLm5vZGVUeXBlfHw0PT09ZS5ub2RlVHlwZSlyZXR1cm4hMTtyZXR1cm4hMH0scGFyZW50OmZ1bmN0aW9uKGUpe3JldHVybiFpLnBzZXVkb3MuZW1wdHkoZSl9LGhlYWRlcjpmdW5jdGlvbihlKXtyZXR1cm4gUS50ZXN0KGUubm9kZU5hbWUpfSxpbnB1dDpmdW5jdGlvbihlKXtyZXR1cm4gRy50ZXN0KGUubm9kZU5hbWUpfSxidXR0b246ZnVuY3Rpb24oZSl7dmFyIHQ9ZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpO3JldHVyblwiaW5wdXRcIj09PXQmJlwiYnV0dG9uXCI9PT1lLnR5cGV8fFwiYnV0dG9uXCI9PT10fSx0ZXh0OmZ1bmN0aW9uKGUpe3ZhciB0O3JldHVyblwiaW5wdXRcIj09PWUubm9kZU5hbWUudG9Mb3dlckNhc2UoKSYmXCJ0ZXh0XCI9PT1lLnR5cGUmJihudWxsPT0odD1lLmdldEF0dHJpYnV0ZShcInR5cGVcIikpfHx0LnRvTG93ZXJDYXNlKCk9PT1lLnR5cGUpfSxmaXJzdDpwdChmdW5jdGlvbigpe3JldHVyblswXX0pLGxhc3Q6cHQoZnVuY3Rpb24oZSx0KXtyZXR1cm5bdC0xXX0pLGVxOnB0KGZ1bmN0aW9uKGUsdCxuKXtyZXR1cm5bMD5uP24rdDpuXX0pLGV2ZW46cHQoZnVuY3Rpb24oZSx0KXt2YXIgbj0wO2Zvcig7dD5uO24rPTIpZS5wdXNoKG4pO3JldHVybiBlfSksb2RkOnB0KGZ1bmN0aW9uKGUsdCl7dmFyIG49MTtmb3IoO3Q+bjtuKz0yKWUucHVzaChuKTtyZXR1cm4gZX0pLGx0OnB0KGZ1bmN0aW9uKGUsdCxuKXt2YXIgcj0wPm4/bit0Om47Zm9yKDstLXI+PTA7KWUucHVzaChyKTtyZXR1cm4gZX0pLGd0OnB0KGZ1bmN0aW9uKGUsdCxuKXt2YXIgcj0wPm4/bit0Om47Zm9yKDt0PisrcjspZS5wdXNoKHIpO3JldHVybiBlfSl9fTtmb3IobiBpbntyYWRpbzohMCxjaGVja2JveDohMCxmaWxlOiEwLHBhc3N3b3JkOiEwLGltYWdlOiEwfSlpLnBzZXVkb3Nbbl09bHQobik7Zm9yKG4gaW57c3VibWl0OiEwLHJlc2V0OiEwfSlpLnBzZXVkb3Nbbl09Y3Qobik7ZnVuY3Rpb24gZnQoZSx0KXt2YXIgbixyLG8sYSxzLHUsbCxjPUVbZStcIiBcIl07aWYoYylyZXR1cm4gdD8wOmMuc2xpY2UoMCk7cz1lLHU9W10sbD1pLnByZUZpbHRlcjt3aGlsZShzKXsoIW58fChyPSQuZXhlYyhzKSkpJiYociYmKHM9cy5zbGljZShyWzBdLmxlbmd0aCl8fHMpLHUucHVzaChvPVtdKSksbj0hMSwocj1JLmV4ZWMocykpJiYobj1yLnNoaWZ0KCksby5wdXNoKHt2YWx1ZTpuLHR5cGU6clswXS5yZXBsYWNlKFcsXCIgXCIpfSkscz1zLnNsaWNlKG4ubGVuZ3RoKSk7Zm9yKGEgaW4gaS5maWx0ZXIpIShyPVVbYV0uZXhlYyhzKSl8fGxbYV0mJiEocj1sW2FdKHIpKXx8KG49ci5zaGlmdCgpLG8ucHVzaCh7dmFsdWU6bix0eXBlOmEsbWF0Y2hlczpyfSkscz1zLnNsaWNlKG4ubGVuZ3RoKSk7aWYoIW4pYnJlYWt9cmV0dXJuIHQ/cy5sZW5ndGg6cz9zdC5lcnJvcihlKTpFKGUsdSkuc2xpY2UoMCl9ZnVuY3Rpb24gZHQoZSl7dmFyIHQ9MCxuPWUubGVuZ3RoLHI9XCJcIjtmb3IoO24+dDt0Kyspcis9ZVt0XS52YWx1ZTtyZXR1cm4gcn1mdW5jdGlvbiBodChlLHQsbil7dmFyIGk9dC5kaXIsbz1uJiZcInBhcmVudE5vZGVcIj09PWksYT1DKys7cmV0dXJuIHQuZmlyc3Q/ZnVuY3Rpb24odCxuLHIpe3doaWxlKHQ9dFtpXSlpZigxPT09dC5ub2RlVHlwZXx8bylyZXR1cm4gZSh0LG4scil9OmZ1bmN0aW9uKHQsbixzKXt2YXIgdSxsLGMscD1OK1wiIFwiK2E7aWYocyl7d2hpbGUodD10W2ldKWlmKCgxPT09dC5ub2RlVHlwZXx8bykmJmUodCxuLHMpKXJldHVybiEwfWVsc2Ugd2hpbGUodD10W2ldKWlmKDE9PT10Lm5vZGVUeXBlfHxvKWlmKGM9dFt4XXx8KHRbeF09e30pLChsPWNbaV0pJiZsWzBdPT09cCl7aWYoKHU9bFsxXSk9PT0hMHx8dT09PXIpcmV0dXJuIHU9PT0hMH1lbHNlIGlmKGw9Y1tpXT1bcF0sbFsxXT1lKHQsbixzKXx8cixsWzFdPT09ITApcmV0dXJuITB9fWZ1bmN0aW9uIGd0KGUpe3JldHVybiBlLmxlbmd0aD4xP2Z1bmN0aW9uKHQsbixyKXt2YXIgaT1lLmxlbmd0aDt3aGlsZShpLS0paWYoIWVbaV0odCxuLHIpKXJldHVybiExO3JldHVybiEwfTplWzBdfWZ1bmN0aW9uIG10KGUsdCxuLHIsaSl7dmFyIG8sYT1bXSxzPTAsdT1lLmxlbmd0aCxsPW51bGwhPXQ7Zm9yKDt1PnM7cysrKShvPWVbc10pJiYoIW58fG4obyxyLGkpKSYmKGEucHVzaChvKSxsJiZ0LnB1c2gocykpO3JldHVybiBhfWZ1bmN0aW9uIHl0KGUsdCxuLHIsaSxvKXtyZXR1cm4gciYmIXJbeF0mJihyPXl0KHIpKSxpJiYhaVt4XSYmKGk9eXQoaSxvKSksb3QoZnVuY3Rpb24obyxhLHMsdSl7dmFyIGwsYyxwLGY9W10sZD1bXSxoPWEubGVuZ3RoLGc9b3x8eHQodHx8XCIqXCIscy5ub2RlVHlwZT9bc106cyxbXSksbT0hZXx8IW8mJnQ/ZzptdChnLGYsZSxzLHUpLHk9bj9pfHwobz9lOmh8fHIpP1tdOmE6bTtpZihuJiZuKG0seSxzLHUpLHIpe2w9bXQoeSxkKSxyKGwsW10scyx1KSxjPWwubGVuZ3RoO3doaWxlKGMtLSkocD1sW2NdKSYmKHlbZFtjXV09IShtW2RbY11dPXApKX1pZihvKXtpZihpfHxlKXtpZihpKXtsPVtdLGM9eS5sZW5ndGg7d2hpbGUoYy0tKShwPXlbY10pJiZsLnB1c2gobVtjXT1wKTtpKG51bGwseT1bXSxsLHUpfWM9eS5sZW5ndGg7d2hpbGUoYy0tKShwPXlbY10pJiYobD1pP00uY2FsbChvLHApOmZbY10pPi0xJiYob1tsXT0hKGFbbF09cCkpfX1lbHNlIHk9bXQoeT09PWE/eS5zcGxpY2UoaCx5Lmxlbmd0aCk6eSksaT9pKG51bGwsYSx5LHUpOkguYXBwbHkoYSx5KX0pfWZ1bmN0aW9uIHZ0KGUpe3ZhciB0LG4scixvPWUubGVuZ3RoLGE9aS5yZWxhdGl2ZVtlWzBdLnR5cGVdLHM9YXx8aS5yZWxhdGl2ZVtcIiBcIl0sdT1hPzE6MCxjPWh0KGZ1bmN0aW9uKGUpe3JldHVybiBlPT09dH0scywhMCkscD1odChmdW5jdGlvbihlKXtyZXR1cm4gTS5jYWxsKHQsZSk+LTF9LHMsITApLGY9W2Z1bmN0aW9uKGUsbixyKXtyZXR1cm4hYSYmKHJ8fG4hPT1sKXx8KCh0PW4pLm5vZGVUeXBlP2MoZSxuLHIpOnAoZSxuLHIpKX1dO2Zvcig7bz51O3UrKylpZihuPWkucmVsYXRpdmVbZVt1XS50eXBlXSlmPVtodChndChmKSxuKV07ZWxzZXtpZihuPWkuZmlsdGVyW2VbdV0udHlwZV0uYXBwbHkobnVsbCxlW3VdLm1hdGNoZXMpLG5beF0pe2ZvcihyPSsrdTtvPnI7cisrKWlmKGkucmVsYXRpdmVbZVtyXS50eXBlXSlicmVhaztyZXR1cm4geXQodT4xJiZndChmKSx1PjEmJmR0KGUuc2xpY2UoMCx1LTEpKS5yZXBsYWNlKFcsXCIkMVwiKSxuLHI+dSYmdnQoZS5zbGljZSh1LHIpKSxvPnImJnZ0KGU9ZS5zbGljZShyKSksbz5yJiZkdChlKSl9Zi5wdXNoKG4pfXJldHVybiBndChmKX1mdW5jdGlvbiBidChlLHQpe3ZhciBuPTAsbz10Lmxlbmd0aD4wLGE9ZS5sZW5ndGg+MCxzPWZ1bmN0aW9uKHMsdSxjLGYsZCl7dmFyIGgsZyxtLHk9W10sdj0wLGI9XCIwXCIseD1zJiZbXSx3PW51bGwhPWQsVD1sLEM9c3x8YSYmaS5maW5kLlRBRyhcIipcIixkJiZ1LnBhcmVudE5vZGV8fHUpLGs9Tis9bnVsbD09VD8xOk1hdGgucmFuZG9tKCl8fC4xO2Zvcih3JiYobD11IT09cCYmdSxyPW4pO251bGwhPShoPUNbYl0pO2IrKyl7aWYoYSYmaCl7Zz0wO3doaWxlKG09ZVtnKytdKWlmKG0oaCx1LGMpKXtmLnB1c2goaCk7YnJlYWt9dyYmKE49ayxyPSsrbil9byYmKChoPSFtJiZoKSYmdi0tLHMmJngucHVzaChoKSl9aWYodis9YixvJiZiIT09dil7Zz0wO3doaWxlKG09dFtnKytdKW0oeCx5LHUsYyk7aWYocyl7aWYodj4wKXdoaWxlKGItLSl4W2JdfHx5W2JdfHwoeVtiXT1MLmNhbGwoZikpO3k9bXQoeSl9SC5hcHBseShmLHkpLHcmJiFzJiZ5Lmxlbmd0aD4wJiZ2K3QubGVuZ3RoPjEmJnN0LnVuaXF1ZVNvcnQoZil9cmV0dXJuIHcmJihOPWssbD1UKSx4fTtyZXR1cm4gbz9vdChzKTpzfXM9c3QuY29tcGlsZT1mdW5jdGlvbihlLHQpe3ZhciBuLHI9W10saT1bXSxvPVNbZStcIiBcIl07aWYoIW8pe3R8fCh0PWZ0KGUpKSxuPXQubGVuZ3RoO3doaWxlKG4tLSlvPXZ0KHRbbl0pLG9beF0/ci5wdXNoKG8pOmkucHVzaChvKTtvPVMoZSxidChpLHIpKX1yZXR1cm4gb307ZnVuY3Rpb24geHQoZSx0LG4pe3ZhciByPTAsaT10Lmxlbmd0aDtmb3IoO2k+cjtyKyspc3QoZSx0W3JdLG4pO3JldHVybiBufWZ1bmN0aW9uIHd0KGUsdCxuLHIpe3ZhciBvLGEsdSxsLGMscD1mdChlKTtpZighciYmMT09PXAubGVuZ3RoKXtpZihhPXBbMF09cFswXS5zbGljZSgwKSxhLmxlbmd0aD4yJiZcIklEXCI9PT0odT1hWzBdKS50eXBlJiY5PT09dC5ub2RlVHlwZSYmIWQmJmkucmVsYXRpdmVbYVsxXS50eXBlXSl7aWYodD1pLmZpbmQuSUQodS5tYXRjaGVzWzBdLnJlcGxhY2UoZXQsdHQpLHQpWzBdLCF0KXJldHVybiBuO2U9ZS5zbGljZShhLnNoaWZ0KCkudmFsdWUubGVuZ3RoKX1vPVUubmVlZHNDb250ZXh0LnRlc3QoZSk/MDphLmxlbmd0aDt3aGlsZShvLS0pe2lmKHU9YVtvXSxpLnJlbGF0aXZlW2w9dS50eXBlXSlicmVhaztpZigoYz1pLmZpbmRbbF0pJiYocj1jKHUubWF0Y2hlc1swXS5yZXBsYWNlKGV0LHR0KSxWLnRlc3QoYVswXS50eXBlKSYmdC5wYXJlbnROb2RlfHx0KSkpe2lmKGEuc3BsaWNlKG8sMSksZT1yLmxlbmd0aCYmZHQoYSksIWUpcmV0dXJuIEguYXBwbHkobixxLmNhbGwociwwKSksbjticmVha319fXJldHVybiBzKGUscCkocix0LGQsbixWLnRlc3QoZSkpLG59aS5wc2V1ZG9zLm50aD1pLnBzZXVkb3MuZXE7ZnVuY3Rpb24gVHQoKXt9aS5maWx0ZXJzPVR0LnByb3RvdHlwZT1pLnBzZXVkb3MsaS5zZXRGaWx0ZXJzPW5ldyBUdCxjKCksc3QuYXR0cj1iLmF0dHIsYi5maW5kPXN0LGIuZXhwcj1zdC5zZWxlY3RvcnMsYi5leHByW1wiOlwiXT1iLmV4cHIucHNldWRvcyxiLnVuaXF1ZT1zdC51bmlxdWVTb3J0LGIudGV4dD1zdC5nZXRUZXh0LGIuaXNYTUxEb2M9c3QuaXNYTUwsYi5jb250YWlucz1zdC5jb250YWluc30oZSk7dmFyIGF0PS9VbnRpbCQvLHN0PS9eKD86cGFyZW50c3xwcmV2KD86VW50aWx8QWxsKSkvLHV0PS9eLlteOiNcXFtcXC4sXSokLyxsdD1iLmV4cHIubWF0Y2gubmVlZHNDb250ZXh0LGN0PXtjaGlsZHJlbjohMCxjb250ZW50czohMCxuZXh0OiEwLHByZXY6ITB9O2IuZm4uZXh0ZW5kKHtmaW5kOmZ1bmN0aW9uKGUpe3ZhciB0LG4scixpPXRoaXMubGVuZ3RoO2lmKFwic3RyaW5nXCIhPXR5cGVvZiBlKXJldHVybiByPXRoaXMsdGhpcy5wdXNoU3RhY2soYihlKS5maWx0ZXIoZnVuY3Rpb24oKXtmb3IodD0wO2k+dDt0KyspaWYoYi5jb250YWlucyhyW3RdLHRoaXMpKXJldHVybiEwfSkpO2ZvcihuPVtdLHQ9MDtpPnQ7dCsrKWIuZmluZChlLHRoaXNbdF0sbik7cmV0dXJuIG49dGhpcy5wdXNoU3RhY2soaT4xP2IudW5pcXVlKG4pOm4pLG4uc2VsZWN0b3I9KHRoaXMuc2VsZWN0b3I/dGhpcy5zZWxlY3RvcitcIiBcIjpcIlwiKStlLG59LGhhczpmdW5jdGlvbihlKXt2YXIgdCxuPWIoZSx0aGlzKSxyPW4ubGVuZ3RoO3JldHVybiB0aGlzLmZpbHRlcihmdW5jdGlvbigpe2Zvcih0PTA7cj50O3QrKylpZihiLmNvbnRhaW5zKHRoaXMsblt0XSkpcmV0dXJuITB9KX0sbm90OmZ1bmN0aW9uKGUpe3JldHVybiB0aGlzLnB1c2hTdGFjayhmdCh0aGlzLGUsITEpKX0sZmlsdGVyOmZ1bmN0aW9uKGUpe3JldHVybiB0aGlzLnB1c2hTdGFjayhmdCh0aGlzLGUsITApKX0saXM6ZnVuY3Rpb24oZSl7cmV0dXJuISFlJiYoXCJzdHJpbmdcIj09dHlwZW9mIGU/bHQudGVzdChlKT9iKGUsdGhpcy5jb250ZXh0KS5pbmRleCh0aGlzWzBdKT49MDpiLmZpbHRlcihlLHRoaXMpLmxlbmd0aD4wOnRoaXMuZmlsdGVyKGUpLmxlbmd0aD4wKX0sY2xvc2VzdDpmdW5jdGlvbihlLHQpe3ZhciBuLHI9MCxpPXRoaXMubGVuZ3RoLG89W10sYT1sdC50ZXN0KGUpfHxcInN0cmluZ1wiIT10eXBlb2YgZT9iKGUsdHx8dGhpcy5jb250ZXh0KTowO2Zvcig7aT5yO3IrKyl7bj10aGlzW3JdO3doaWxlKG4mJm4ub3duZXJEb2N1bWVudCYmbiE9PXQmJjExIT09bi5ub2RlVHlwZSl7aWYoYT9hLmluZGV4KG4pPi0xOmIuZmluZC5tYXRjaGVzU2VsZWN0b3IobixlKSl7by5wdXNoKG4pO2JyZWFrfW49bi5wYXJlbnROb2RlfX1yZXR1cm4gdGhpcy5wdXNoU3RhY2soby5sZW5ndGg+MT9iLnVuaXF1ZShvKTpvKX0saW5kZXg6ZnVuY3Rpb24oZSl7cmV0dXJuIGU/XCJzdHJpbmdcIj09dHlwZW9mIGU/Yi5pbkFycmF5KHRoaXNbMF0sYihlKSk6Yi5pbkFycmF5KGUuanF1ZXJ5P2VbMF06ZSx0aGlzKTp0aGlzWzBdJiZ0aGlzWzBdLnBhcmVudE5vZGU/dGhpcy5maXJzdCgpLnByZXZBbGwoKS5sZW5ndGg6LTF9LGFkZDpmdW5jdGlvbihlLHQpe3ZhciBuPVwic3RyaW5nXCI9PXR5cGVvZiBlP2IoZSx0KTpiLm1ha2VBcnJheShlJiZlLm5vZGVUeXBlP1tlXTplKSxyPWIubWVyZ2UodGhpcy5nZXQoKSxuKTtyZXR1cm4gdGhpcy5wdXNoU3RhY2soYi51bmlxdWUocikpfSxhZGRCYWNrOmZ1bmN0aW9uKGUpe3JldHVybiB0aGlzLmFkZChudWxsPT1lP3RoaXMucHJldk9iamVjdDp0aGlzLnByZXZPYmplY3QuZmlsdGVyKGUpKX19KSxiLmZuLmFuZFNlbGY9Yi5mbi5hZGRCYWNrO2Z1bmN0aW9uIHB0KGUsdCl7ZG8gZT1lW3RdO3doaWxlKGUmJjEhPT1lLm5vZGVUeXBlKTtyZXR1cm4gZX1iLmVhY2goe3BhcmVudDpmdW5jdGlvbihlKXt2YXIgdD1lLnBhcmVudE5vZGU7cmV0dXJuIHQmJjExIT09dC5ub2RlVHlwZT90Om51bGx9LHBhcmVudHM6ZnVuY3Rpb24oZSl7cmV0dXJuIGIuZGlyKGUsXCJwYXJlbnROb2RlXCIpfSxwYXJlbnRzVW50aWw6ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBiLmRpcihlLFwicGFyZW50Tm9kZVwiLG4pfSxuZXh0OmZ1bmN0aW9uKGUpe3JldHVybiBwdChlLFwibmV4dFNpYmxpbmdcIil9LHByZXY6ZnVuY3Rpb24oZSl7cmV0dXJuIHB0KGUsXCJwcmV2aW91c1NpYmxpbmdcIil9LG5leHRBbGw6ZnVuY3Rpb24oZSl7cmV0dXJuIGIuZGlyKGUsXCJuZXh0U2libGluZ1wiKX0scHJldkFsbDpmdW5jdGlvbihlKXtyZXR1cm4gYi5kaXIoZSxcInByZXZpb3VzU2libGluZ1wiKX0sbmV4dFVudGlsOmZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gYi5kaXIoZSxcIm5leHRTaWJsaW5nXCIsbil9LHByZXZVbnRpbDpmdW5jdGlvbihlLHQsbil7cmV0dXJuIGIuZGlyKGUsXCJwcmV2aW91c1NpYmxpbmdcIixuKX0sc2libGluZ3M6ZnVuY3Rpb24oZSl7cmV0dXJuIGIuc2libGluZygoZS5wYXJlbnROb2RlfHx7fSkuZmlyc3RDaGlsZCxlKX0sY2hpbGRyZW46ZnVuY3Rpb24oZSl7cmV0dXJuIGIuc2libGluZyhlLmZpcnN0Q2hpbGQpfSxjb250ZW50czpmdW5jdGlvbihlKXtyZXR1cm4gYi5ub2RlTmFtZShlLFwiaWZyYW1lXCIpP2UuY29udGVudERvY3VtZW50fHxlLmNvbnRlbnRXaW5kb3cuZG9jdW1lbnQ6Yi5tZXJnZShbXSxlLmNoaWxkTm9kZXMpfX0sZnVuY3Rpb24oZSx0KXtiLmZuW2VdPWZ1bmN0aW9uKG4scil7dmFyIGk9Yi5tYXAodGhpcyx0LG4pO3JldHVybiBhdC50ZXN0KGUpfHwocj1uKSxyJiZcInN0cmluZ1wiPT10eXBlb2YgciYmKGk9Yi5maWx0ZXIocixpKSksaT10aGlzLmxlbmd0aD4xJiYhY3RbZV0/Yi51bmlxdWUoaSk6aSx0aGlzLmxlbmd0aD4xJiZzdC50ZXN0KGUpJiYoaT1pLnJldmVyc2UoKSksdGhpcy5wdXNoU3RhY2soaSl9fSksYi5leHRlbmQoe2ZpbHRlcjpmdW5jdGlvbihlLHQsbil7cmV0dXJuIG4mJihlPVwiOm5vdChcIitlK1wiKVwiKSwxPT09dC5sZW5ndGg/Yi5maW5kLm1hdGNoZXNTZWxlY3Rvcih0WzBdLGUpP1t0WzBdXTpbXTpiLmZpbmQubWF0Y2hlcyhlLHQpfSxkaXI6ZnVuY3Rpb24oZSxuLHIpe3ZhciBpPVtdLG89ZVtuXTt3aGlsZShvJiY5IT09by5ub2RlVHlwZSYmKHI9PT10fHwxIT09by5ub2RlVHlwZXx8IWIobykuaXMocikpKTE9PT1vLm5vZGVUeXBlJiZpLnB1c2gobyksbz1vW25dO3JldHVybiBpfSxzaWJsaW5nOmZ1bmN0aW9uKGUsdCl7dmFyIG49W107Zm9yKDtlO2U9ZS5uZXh0U2libGluZykxPT09ZS5ub2RlVHlwZSYmZSE9PXQmJm4ucHVzaChlKTtyZXR1cm4gbn19KTtmdW5jdGlvbiBmdChlLHQsbil7aWYodD10fHwwLGIuaXNGdW5jdGlvbih0KSlyZXR1cm4gYi5ncmVwKGUsZnVuY3Rpb24oZSxyKXt2YXIgaT0hIXQuY2FsbChlLHIsZSk7cmV0dXJuIGk9PT1ufSk7aWYodC5ub2RlVHlwZSlyZXR1cm4gYi5ncmVwKGUsZnVuY3Rpb24oZSl7cmV0dXJuIGU9PT10PT09bn0pO2lmKFwic3RyaW5nXCI9PXR5cGVvZiB0KXt2YXIgcj1iLmdyZXAoZSxmdW5jdGlvbihlKXtyZXR1cm4gMT09PWUubm9kZVR5cGV9KTtpZih1dC50ZXN0KHQpKXJldHVybiBiLmZpbHRlcih0LHIsIW4pO3Q9Yi5maWx0ZXIodCxyKX1yZXR1cm4gYi5ncmVwKGUsZnVuY3Rpb24oZSl7cmV0dXJuIGIuaW5BcnJheShlLHQpPj0wPT09bn0pfWZ1bmN0aW9uIGR0KGUpe3ZhciB0PWh0LnNwbGl0KFwifFwiKSxuPWUuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO2lmKG4uY3JlYXRlRWxlbWVudCl3aGlsZSh0Lmxlbmd0aCluLmNyZWF0ZUVsZW1lbnQodC5wb3AoKSk7cmV0dXJuIG59dmFyIGh0PVwiYWJicnxhcnRpY2xlfGFzaWRlfGF1ZGlvfGJkaXxjYW52YXN8ZGF0YXxkYXRhbGlzdHxkZXRhaWxzfGZpZ2NhcHRpb258ZmlndXJlfGZvb3RlcnxoZWFkZXJ8aGdyb3VwfG1hcmt8bWV0ZXJ8bmF2fG91dHB1dHxwcm9ncmVzc3xzZWN0aW9ufHN1bW1hcnl8dGltZXx2aWRlb1wiLGd0PS8galF1ZXJ5XFxkKz1cIig/Om51bGx8XFxkKylcIi9nLG10PVJlZ0V4cChcIjwoPzpcIitodCtcIilbXFxcXHMvPl1cIixcImlcIikseXQ9L15cXHMrLyx2dD0vPCg/IWFyZWF8YnJ8Y29sfGVtYmVkfGhyfGltZ3xpbnB1dHxsaW5rfG1ldGF8cGFyYW0pKChbXFx3Ol0rKVtePl0qKVxcLz4vZ2ksYnQ9LzwoW1xcdzpdKykvLHh0PS88dGJvZHkvaSx3dD0vPHwmIz9cXHcrOy8sVHQ9LzwoPzpzY3JpcHR8c3R5bGV8bGluaykvaSxOdD0vXig/OmNoZWNrYm94fHJhZGlvKSQvaSxDdD0vY2hlY2tlZFxccyooPzpbXj1dfD1cXHMqLmNoZWNrZWQuKS9pLGt0PS9eJHxcXC8oPzpqYXZhfGVjbWEpc2NyaXB0L2ksRXQ9L150cnVlXFwvKC4qKS8sU3Q9L15cXHMqPCEoPzpcXFtDREFUQVxcW3wtLSl8KD86XFxdXFxdfC0tKT5cXHMqJC9nLEF0PXtvcHRpb246WzEsXCI8c2VsZWN0IG11bHRpcGxlPSdtdWx0aXBsZSc+XCIsXCI8L3NlbGVjdD5cIl0sbGVnZW5kOlsxLFwiPGZpZWxkc2V0PlwiLFwiPC9maWVsZHNldD5cIl0sYXJlYTpbMSxcIjxtYXA+XCIsXCI8L21hcD5cIl0scGFyYW06WzEsXCI8b2JqZWN0PlwiLFwiPC9vYmplY3Q+XCJdLHRoZWFkOlsxLFwiPHRhYmxlPlwiLFwiPC90YWJsZT5cIl0sdHI6WzIsXCI8dGFibGU+PHRib2R5PlwiLFwiPC90Ym9keT48L3RhYmxlPlwiXSxjb2w6WzIsXCI8dGFibGU+PHRib2R5PjwvdGJvZHk+PGNvbGdyb3VwPlwiLFwiPC9jb2xncm91cD48L3RhYmxlPlwiXSx0ZDpbMyxcIjx0YWJsZT48dGJvZHk+PHRyPlwiLFwiPC90cj48L3Rib2R5PjwvdGFibGU+XCJdLF9kZWZhdWx0OmIuc3VwcG9ydC5odG1sU2VyaWFsaXplP1swLFwiXCIsXCJcIl06WzEsXCJYPGRpdj5cIixcIjwvZGl2PlwiXX0sanQ9ZHQobyksRHQ9anQuYXBwZW5kQ2hpbGQoby5jcmVhdGVFbGVtZW50KFwiZGl2XCIpKTtBdC5vcHRncm91cD1BdC5vcHRpb24sQXQudGJvZHk9QXQudGZvb3Q9QXQuY29sZ3JvdXA9QXQuY2FwdGlvbj1BdC50aGVhZCxBdC50aD1BdC50ZCxiLmZuLmV4dGVuZCh7dGV4dDpmdW5jdGlvbihlKXtyZXR1cm4gYi5hY2Nlc3ModGhpcyxmdW5jdGlvbihlKXtyZXR1cm4gZT09PXQ/Yi50ZXh0KHRoaXMpOnRoaXMuZW1wdHkoKS5hcHBlbmQoKHRoaXNbMF0mJnRoaXNbMF0ub3duZXJEb2N1bWVudHx8bykuY3JlYXRlVGV4dE5vZGUoZSkpfSxudWxsLGUsYXJndW1lbnRzLmxlbmd0aCl9LHdyYXBBbGw6ZnVuY3Rpb24oZSl7aWYoYi5pc0Z1bmN0aW9uKGUpKXJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24odCl7Yih0aGlzKS53cmFwQWxsKGUuY2FsbCh0aGlzLHQpKX0pO2lmKHRoaXNbMF0pe3ZhciB0PWIoZSx0aGlzWzBdLm93bmVyRG9jdW1lbnQpLmVxKDApLmNsb25lKCEwKTt0aGlzWzBdLnBhcmVudE5vZGUmJnQuaW5zZXJ0QmVmb3JlKHRoaXNbMF0pLHQubWFwKGZ1bmN0aW9uKCl7dmFyIGU9dGhpczt3aGlsZShlLmZpcnN0Q2hpbGQmJjE9PT1lLmZpcnN0Q2hpbGQubm9kZVR5cGUpZT1lLmZpcnN0Q2hpbGQ7cmV0dXJuIGV9KS5hcHBlbmQodGhpcyl9cmV0dXJuIHRoaXN9LHdyYXBJbm5lcjpmdW5jdGlvbihlKXtyZXR1cm4gYi5pc0Z1bmN0aW9uKGUpP3RoaXMuZWFjaChmdW5jdGlvbih0KXtiKHRoaXMpLndyYXBJbm5lcihlLmNhbGwodGhpcyx0KSl9KTp0aGlzLmVhY2goZnVuY3Rpb24oKXt2YXIgdD1iKHRoaXMpLG49dC5jb250ZW50cygpO24ubGVuZ3RoP24ud3JhcEFsbChlKTp0LmFwcGVuZChlKX0pfSx3cmFwOmZ1bmN0aW9uKGUpe3ZhciB0PWIuaXNGdW5jdGlvbihlKTtyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKG4pe2IodGhpcykud3JhcEFsbCh0P2UuY2FsbCh0aGlzLG4pOmUpfSl9LHVud3JhcDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnBhcmVudCgpLmVhY2goZnVuY3Rpb24oKXtiLm5vZGVOYW1lKHRoaXMsXCJib2R5XCIpfHxiKHRoaXMpLnJlcGxhY2VXaXRoKHRoaXMuY2hpbGROb2Rlcyl9KS5lbmQoKX0sYXBwZW5kOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZG9tTWFuaXAoYXJndW1lbnRzLCEwLGZ1bmN0aW9uKGUpeygxPT09dGhpcy5ub2RlVHlwZXx8MTE9PT10aGlzLm5vZGVUeXBlfHw5PT09dGhpcy5ub2RlVHlwZSkmJnRoaXMuYXBwZW5kQ2hpbGQoZSl9KX0scHJlcGVuZDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmRvbU1hbmlwKGFyZ3VtZW50cywhMCxmdW5jdGlvbihlKXsoMT09PXRoaXMubm9kZVR5cGV8fDExPT09dGhpcy5ub2RlVHlwZXx8OT09PXRoaXMubm9kZVR5cGUpJiZ0aGlzLmluc2VydEJlZm9yZShlLHRoaXMuZmlyc3RDaGlsZCl9KX0sYmVmb3JlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZG9tTWFuaXAoYXJndW1lbnRzLCExLGZ1bmN0aW9uKGUpe3RoaXMucGFyZW50Tm9kZSYmdGhpcy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShlLHRoaXMpfSl9LGFmdGVyOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZG9tTWFuaXAoYXJndW1lbnRzLCExLGZ1bmN0aW9uKGUpe3RoaXMucGFyZW50Tm9kZSYmdGhpcy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShlLHRoaXMubmV4dFNpYmxpbmcpfSl9LHJlbW92ZTpmdW5jdGlvbihlLHQpe3ZhciBuLHI9MDtmb3IoO251bGwhPShuPXRoaXNbcl0pO3IrKykoIWV8fGIuZmlsdGVyKGUsW25dKS5sZW5ndGg+MCkmJih0fHwxIT09bi5ub2RlVHlwZXx8Yi5jbGVhbkRhdGEoT3QobikpLG4ucGFyZW50Tm9kZSYmKHQmJmIuY29udGFpbnMobi5vd25lckRvY3VtZW50LG4pJiZNdChPdChuLFwic2NyaXB0XCIpKSxuLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQobikpKTtyZXR1cm4gdGhpc30sZW1wdHk6ZnVuY3Rpb24oKXt2YXIgZSx0PTA7Zm9yKDtudWxsIT0oZT10aGlzW3RdKTt0KyspezE9PT1lLm5vZGVUeXBlJiZiLmNsZWFuRGF0YShPdChlLCExKSk7d2hpbGUoZS5maXJzdENoaWxkKWUucmVtb3ZlQ2hpbGQoZS5maXJzdENoaWxkKTtlLm9wdGlvbnMmJmIubm9kZU5hbWUoZSxcInNlbGVjdFwiKSYmKGUub3B0aW9ucy5sZW5ndGg9MCl9cmV0dXJuIHRoaXN9LGNsb25lOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIGU9bnVsbD09ZT8hMTplLHQ9bnVsbD09dD9lOnQsdGhpcy5tYXAoZnVuY3Rpb24oKXtyZXR1cm4gYi5jbG9uZSh0aGlzLGUsdCl9KX0saHRtbDpmdW5jdGlvbihlKXtyZXR1cm4gYi5hY2Nlc3ModGhpcyxmdW5jdGlvbihlKXt2YXIgbj10aGlzWzBdfHx7fSxyPTAsaT10aGlzLmxlbmd0aDtpZihlPT09dClyZXR1cm4gMT09PW4ubm9kZVR5cGU/bi5pbm5lckhUTUwucmVwbGFjZShndCxcIlwiKTp0O2lmKCEoXCJzdHJpbmdcIiE9dHlwZW9mIGV8fFR0LnRlc3QoZSl8fCFiLnN1cHBvcnQuaHRtbFNlcmlhbGl6ZSYmbXQudGVzdChlKXx8IWIuc3VwcG9ydC5sZWFkaW5nV2hpdGVzcGFjZSYmeXQudGVzdChlKXx8QXRbKGJ0LmV4ZWMoZSl8fFtcIlwiLFwiXCJdKVsxXS50b0xvd2VyQ2FzZSgpXSkpe2U9ZS5yZXBsYWNlKHZ0LFwiPCQxPjwvJDI+XCIpO3RyeXtmb3IoO2k+cjtyKyspbj10aGlzW3JdfHx7fSwxPT09bi5ub2RlVHlwZSYmKGIuY2xlYW5EYXRhKE90KG4sITEpKSxuLmlubmVySFRNTD1lKTtuPTB9Y2F0Y2gobyl7fX1uJiZ0aGlzLmVtcHR5KCkuYXBwZW5kKGUpfSxudWxsLGUsYXJndW1lbnRzLmxlbmd0aCl9LHJlcGxhY2VXaXRoOmZ1bmN0aW9uKGUpe3ZhciB0PWIuaXNGdW5jdGlvbihlKTtyZXR1cm4gdHx8XCJzdHJpbmdcIj09dHlwZW9mIGV8fChlPWIoZSkubm90KHRoaXMpLmRldGFjaCgpKSx0aGlzLmRvbU1hbmlwKFtlXSwhMCxmdW5jdGlvbihlKXt2YXIgdD10aGlzLm5leHRTaWJsaW5nLG49dGhpcy5wYXJlbnROb2RlO24mJihiKHRoaXMpLnJlbW92ZSgpLG4uaW5zZXJ0QmVmb3JlKGUsdCkpfSl9LGRldGFjaDpmdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5yZW1vdmUoZSwhMCl9LGRvbU1hbmlwOmZ1bmN0aW9uKGUsbixyKXtlPWYuYXBwbHkoW10sZSk7dmFyIGksbyxhLHMsdSxsLGM9MCxwPXRoaXMubGVuZ3RoLGQ9dGhpcyxoPXAtMSxnPWVbMF0sbT1iLmlzRnVuY3Rpb24oZyk7aWYobXx8ISgxPj1wfHxcInN0cmluZ1wiIT10eXBlb2YgZ3x8Yi5zdXBwb3J0LmNoZWNrQ2xvbmUpJiZDdC50ZXN0KGcpKXJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oaSl7dmFyIG89ZC5lcShpKTttJiYoZVswXT1nLmNhbGwodGhpcyxpLG4/by5odG1sKCk6dCkpLG8uZG9tTWFuaXAoZSxuLHIpfSk7aWYocCYmKGw9Yi5idWlsZEZyYWdtZW50KGUsdGhpc1swXS5vd25lckRvY3VtZW50LCExLHRoaXMpLGk9bC5maXJzdENoaWxkLDE9PT1sLmNoaWxkTm9kZXMubGVuZ3RoJiYobD1pKSxpKSl7Zm9yKG49biYmYi5ub2RlTmFtZShpLFwidHJcIikscz1iLm1hcChPdChsLFwic2NyaXB0XCIpLEh0KSxhPXMubGVuZ3RoO3A+YztjKyspbz1sLGMhPT1oJiYobz1iLmNsb25lKG8sITAsITApLGEmJmIubWVyZ2UocyxPdChvLFwic2NyaXB0XCIpKSksci5jYWxsKG4mJmIubm9kZU5hbWUodGhpc1tjXSxcInRhYmxlXCIpP0x0KHRoaXNbY10sXCJ0Ym9keVwiKTp0aGlzW2NdLG8sYyk7aWYoYSlmb3IodT1zW3MubGVuZ3RoLTFdLm93bmVyRG9jdW1lbnQsYi5tYXAocyxxdCksYz0wO2E+YztjKyspbz1zW2NdLGt0LnRlc3Qoby50eXBlfHxcIlwiKSYmIWIuX2RhdGEobyxcImdsb2JhbEV2YWxcIikmJmIuY29udGFpbnModSxvKSYmKG8uc3JjP2IuYWpheCh7dXJsOm8uc3JjLHR5cGU6XCJHRVRcIixkYXRhVHlwZTpcInNjcmlwdFwiLGFzeW5jOiExLGdsb2JhbDohMSxcInRocm93c1wiOiEwfSk6Yi5nbG9iYWxFdmFsKChvLnRleHR8fG8udGV4dENvbnRlbnR8fG8uaW5uZXJIVE1MfHxcIlwiKS5yZXBsYWNlKFN0LFwiXCIpKSk7bD1pPW51bGx9cmV0dXJuIHRoaXN9fSk7ZnVuY3Rpb24gTHQoZSx0KXtyZXR1cm4gZS5nZXRFbGVtZW50c0J5VGFnTmFtZSh0KVswXXx8ZS5hcHBlbmRDaGlsZChlLm93bmVyRG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0KSl9ZnVuY3Rpb24gSHQoZSl7dmFyIHQ9ZS5nZXRBdHRyaWJ1dGVOb2RlKFwidHlwZVwiKTtyZXR1cm4gZS50eXBlPSh0JiZ0LnNwZWNpZmllZCkrXCIvXCIrZS50eXBlLGV9ZnVuY3Rpb24gcXQoZSl7dmFyIHQ9RXQuZXhlYyhlLnR5cGUpO3JldHVybiB0P2UudHlwZT10WzFdOmUucmVtb3ZlQXR0cmlidXRlKFwidHlwZVwiKSxlfWZ1bmN0aW9uIE10KGUsdCl7dmFyIG4scj0wO2Zvcig7bnVsbCE9KG49ZVtyXSk7cisrKWIuX2RhdGEobixcImdsb2JhbEV2YWxcIiwhdHx8Yi5fZGF0YSh0W3JdLFwiZ2xvYmFsRXZhbFwiKSl9ZnVuY3Rpb24gX3QoZSx0KXtpZigxPT09dC5ub2RlVHlwZSYmYi5oYXNEYXRhKGUpKXt2YXIgbixyLGksbz1iLl9kYXRhKGUpLGE9Yi5fZGF0YSh0LG8pLHM9by5ldmVudHM7aWYocyl7ZGVsZXRlIGEuaGFuZGxlLGEuZXZlbnRzPXt9O2ZvcihuIGluIHMpZm9yKHI9MCxpPXNbbl0ubGVuZ3RoO2k+cjtyKyspYi5ldmVudC5hZGQodCxuLHNbbl1bcl0pfWEuZGF0YSYmKGEuZGF0YT1iLmV4dGVuZCh7fSxhLmRhdGEpKX19ZnVuY3Rpb24gRnQoZSx0KXt2YXIgbixyLGk7aWYoMT09PXQubm9kZVR5cGUpe2lmKG49dC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpLCFiLnN1cHBvcnQubm9DbG9uZUV2ZW50JiZ0W2IuZXhwYW5kb10pe2k9Yi5fZGF0YSh0KTtmb3IociBpbiBpLmV2ZW50cyliLnJlbW92ZUV2ZW50KHQscixpLmhhbmRsZSk7dC5yZW1vdmVBdHRyaWJ1dGUoYi5leHBhbmRvKX1cInNjcmlwdFwiPT09biYmdC50ZXh0IT09ZS50ZXh0PyhIdCh0KS50ZXh0PWUudGV4dCxxdCh0KSk6XCJvYmplY3RcIj09PW4/KHQucGFyZW50Tm9kZSYmKHQub3V0ZXJIVE1MPWUub3V0ZXJIVE1MKSxiLnN1cHBvcnQuaHRtbDVDbG9uZSYmZS5pbm5lckhUTUwmJiFiLnRyaW0odC5pbm5lckhUTUwpJiYodC5pbm5lckhUTUw9ZS5pbm5lckhUTUwpKTpcImlucHV0XCI9PT1uJiZOdC50ZXN0KGUudHlwZSk/KHQuZGVmYXVsdENoZWNrZWQ9dC5jaGVja2VkPWUuY2hlY2tlZCx0LnZhbHVlIT09ZS52YWx1ZSYmKHQudmFsdWU9ZS52YWx1ZSkpOlwib3B0aW9uXCI9PT1uP3QuZGVmYXVsdFNlbGVjdGVkPXQuc2VsZWN0ZWQ9ZS5kZWZhdWx0U2VsZWN0ZWQ6KFwiaW5wdXRcIj09PW58fFwidGV4dGFyZWFcIj09PW4pJiYodC5kZWZhdWx0VmFsdWU9ZS5kZWZhdWx0VmFsdWUpfX1iLmVhY2goe2FwcGVuZFRvOlwiYXBwZW5kXCIscHJlcGVuZFRvOlwicHJlcGVuZFwiLGluc2VydEJlZm9yZTpcImJlZm9yZVwiLGluc2VydEFmdGVyOlwiYWZ0ZXJcIixyZXBsYWNlQWxsOlwicmVwbGFjZVdpdGhcIn0sZnVuY3Rpb24oZSx0KXtiLmZuW2VdPWZ1bmN0aW9uKGUpe3ZhciBuLHI9MCxpPVtdLG89YihlKSxhPW8ubGVuZ3RoLTE7Zm9yKDthPj1yO3IrKyluPXI9PT1hP3RoaXM6dGhpcy5jbG9uZSghMCksYihvW3JdKVt0XShuKSxkLmFwcGx5KGksbi5nZXQoKSk7cmV0dXJuIHRoaXMucHVzaFN0YWNrKGkpfX0pO2Z1bmN0aW9uIE90KGUsbil7dmFyIHIsbyxhPTAscz10eXBlb2YgZS5nZXRFbGVtZW50c0J5VGFnTmFtZSE9PWk/ZS5nZXRFbGVtZW50c0J5VGFnTmFtZShufHxcIipcIik6dHlwZW9mIGUucXVlcnlTZWxlY3RvckFsbCE9PWk/ZS5xdWVyeVNlbGVjdG9yQWxsKG58fFwiKlwiKTp0O2lmKCFzKWZvcihzPVtdLHI9ZS5jaGlsZE5vZGVzfHxlO251bGwhPShvPXJbYV0pO2ErKykhbnx8Yi5ub2RlTmFtZShvLG4pP3MucHVzaChvKTpiLm1lcmdlKHMsT3QobyxuKSk7cmV0dXJuIG49PT10fHxuJiZiLm5vZGVOYW1lKGUsbik/Yi5tZXJnZShbZV0scyk6c31mdW5jdGlvbiBCdChlKXtOdC50ZXN0KGUudHlwZSkmJihlLmRlZmF1bHRDaGVja2VkPWUuY2hlY2tlZCl9Yi5leHRlbmQoe2Nsb25lOmZ1bmN0aW9uKGUsdCxuKXt2YXIgcixpLG8sYSxzLHU9Yi5jb250YWlucyhlLm93bmVyRG9jdW1lbnQsZSk7aWYoYi5zdXBwb3J0Lmh0bWw1Q2xvbmV8fGIuaXNYTUxEb2MoZSl8fCFtdC50ZXN0KFwiPFwiK2Uubm9kZU5hbWUrXCI+XCIpP289ZS5jbG9uZU5vZGUoITApOihEdC5pbm5lckhUTUw9ZS5vdXRlckhUTUwsRHQucmVtb3ZlQ2hpbGQobz1EdC5maXJzdENoaWxkKSksIShiLnN1cHBvcnQubm9DbG9uZUV2ZW50JiZiLnN1cHBvcnQubm9DbG9uZUNoZWNrZWR8fDEhPT1lLm5vZGVUeXBlJiYxMSE9PWUubm9kZVR5cGV8fGIuaXNYTUxEb2MoZSkpKWZvcihyPU90KG8pLHM9T3QoZSksYT0wO251bGwhPShpPXNbYV0pOysrYSlyW2FdJiZGdChpLHJbYV0pO2lmKHQpaWYobilmb3Iocz1zfHxPdChlKSxyPXJ8fE90KG8pLGE9MDtudWxsIT0oaT1zW2FdKTthKyspX3QoaSxyW2FdKTtlbHNlIF90KGUsbyk7cmV0dXJuIHI9T3QobyxcInNjcmlwdFwiKSxyLmxlbmd0aD4wJiZNdChyLCF1JiZPdChlLFwic2NyaXB0XCIpKSxyPXM9aT1udWxsLG99LGJ1aWxkRnJhZ21lbnQ6ZnVuY3Rpb24oZSx0LG4scil7dmFyIGksbyxhLHMsdSxsLGMscD1lLmxlbmd0aCxmPWR0KHQpLGQ9W10saD0wO2Zvcig7cD5oO2grKylpZihvPWVbaF0sb3x8MD09PW8paWYoXCJvYmplY3RcIj09PWIudHlwZShvKSliLm1lcmdlKGQsby5ub2RlVHlwZT9bb106byk7ZWxzZSBpZih3dC50ZXN0KG8pKXtzPXN8fGYuYXBwZW5kQ2hpbGQodC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpKSx1PShidC5leGVjKG8pfHxbXCJcIixcIlwiXSlbMV0udG9Mb3dlckNhc2UoKSxjPUF0W3VdfHxBdC5fZGVmYXVsdCxzLmlubmVySFRNTD1jWzFdK28ucmVwbGFjZSh2dCxcIjwkMT48LyQyPlwiKStjWzJdLGk9Y1swXTt3aGlsZShpLS0pcz1zLmxhc3RDaGlsZDtpZighYi5zdXBwb3J0LmxlYWRpbmdXaGl0ZXNwYWNlJiZ5dC50ZXN0KG8pJiZkLnB1c2godC5jcmVhdGVUZXh0Tm9kZSh5dC5leGVjKG8pWzBdKSksIWIuc3VwcG9ydC50Ym9keSl7bz1cInRhYmxlXCIhPT11fHx4dC50ZXN0KG8pP1wiPHRhYmxlPlwiIT09Y1sxXXx8eHQudGVzdChvKT8wOnM6cy5maXJzdENoaWxkLGk9byYmby5jaGlsZE5vZGVzLmxlbmd0aDt3aGlsZShpLS0pYi5ub2RlTmFtZShsPW8uY2hpbGROb2Rlc1tpXSxcInRib2R5XCIpJiYhbC5jaGlsZE5vZGVzLmxlbmd0aCYmby5yZW1vdmVDaGlsZChsKVxufWIubWVyZ2UoZCxzLmNoaWxkTm9kZXMpLHMudGV4dENvbnRlbnQ9XCJcIjt3aGlsZShzLmZpcnN0Q2hpbGQpcy5yZW1vdmVDaGlsZChzLmZpcnN0Q2hpbGQpO3M9Zi5sYXN0Q2hpbGR9ZWxzZSBkLnB1c2godC5jcmVhdGVUZXh0Tm9kZShvKSk7cyYmZi5yZW1vdmVDaGlsZChzKSxiLnN1cHBvcnQuYXBwZW5kQ2hlY2tlZHx8Yi5ncmVwKE90KGQsXCJpbnB1dFwiKSxCdCksaD0wO3doaWxlKG89ZFtoKytdKWlmKCghcnx8LTE9PT1iLmluQXJyYXkobyxyKSkmJihhPWIuY29udGFpbnMoby5vd25lckRvY3VtZW50LG8pLHM9T3QoZi5hcHBlbmRDaGlsZChvKSxcInNjcmlwdFwiKSxhJiZNdChzKSxuKSl7aT0wO3doaWxlKG89c1tpKytdKWt0LnRlc3Qoby50eXBlfHxcIlwiKSYmbi5wdXNoKG8pfXJldHVybiBzPW51bGwsZn0sY2xlYW5EYXRhOmZ1bmN0aW9uKGUsdCl7dmFyIG4scixvLGEscz0wLHU9Yi5leHBhbmRvLGw9Yi5jYWNoZSxwPWIuc3VwcG9ydC5kZWxldGVFeHBhbmRvLGY9Yi5ldmVudC5zcGVjaWFsO2Zvcig7bnVsbCE9KG49ZVtzXSk7cysrKWlmKCh0fHxiLmFjY2VwdERhdGEobikpJiYobz1uW3VdLGE9byYmbFtvXSkpe2lmKGEuZXZlbnRzKWZvcihyIGluIGEuZXZlbnRzKWZbcl0/Yi5ldmVudC5yZW1vdmUobixyKTpiLnJlbW92ZUV2ZW50KG4scixhLmhhbmRsZSk7bFtvXSYmKGRlbGV0ZSBsW29dLHA/ZGVsZXRlIG5bdV06dHlwZW9mIG4ucmVtb3ZlQXR0cmlidXRlIT09aT9uLnJlbW92ZUF0dHJpYnV0ZSh1KTpuW3VdPW51bGwsYy5wdXNoKG8pKX19fSk7dmFyIFB0LFJ0LFd0LCR0PS9hbHBoYVxcKFteKV0qXFwpL2ksSXQ9L29wYWNpdHlcXHMqPVxccyooW14pXSopLyx6dD0vXih0b3B8cmlnaHR8Ym90dG9tfGxlZnQpJC8sWHQ9L14obm9uZXx0YWJsZSg/IS1jW2VhXSkuKykvLFV0PS9ebWFyZ2luLyxWdD1SZWdFeHAoXCJeKFwiK3grXCIpKC4qKSRcIixcImlcIiksWXQ9UmVnRXhwKFwiXihcIit4K1wiKSg/IXB4KVthLXolXSskXCIsXCJpXCIpLEp0PVJlZ0V4cChcIl4oWystXSk9KFwiK3grXCIpXCIsXCJpXCIpLEd0PXtCT0RZOlwiYmxvY2tcIn0sUXQ9e3Bvc2l0aW9uOlwiYWJzb2x1dGVcIix2aXNpYmlsaXR5OlwiaGlkZGVuXCIsZGlzcGxheTpcImJsb2NrXCJ9LEt0PXtsZXR0ZXJTcGFjaW5nOjAsZm9udFdlaWdodDo0MDB9LFp0PVtcIlRvcFwiLFwiUmlnaHRcIixcIkJvdHRvbVwiLFwiTGVmdFwiXSxlbj1bXCJXZWJraXRcIixcIk9cIixcIk1velwiLFwibXNcIl07ZnVuY3Rpb24gdG4oZSx0KXtpZih0IGluIGUpcmV0dXJuIHQ7dmFyIG49dC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSt0LnNsaWNlKDEpLHI9dCxpPWVuLmxlbmd0aDt3aGlsZShpLS0paWYodD1lbltpXStuLHQgaW4gZSlyZXR1cm4gdDtyZXR1cm4gcn1mdW5jdGlvbiBubihlLHQpe3JldHVybiBlPXR8fGUsXCJub25lXCI9PT1iLmNzcyhlLFwiZGlzcGxheVwiKXx8IWIuY29udGFpbnMoZS5vd25lckRvY3VtZW50LGUpfWZ1bmN0aW9uIHJuKGUsdCl7dmFyIG4scixpLG89W10sYT0wLHM9ZS5sZW5ndGg7Zm9yKDtzPmE7YSsrKXI9ZVthXSxyLnN0eWxlJiYob1thXT1iLl9kYXRhKHIsXCJvbGRkaXNwbGF5XCIpLG49ci5zdHlsZS5kaXNwbGF5LHQ/KG9bYV18fFwibm9uZVwiIT09bnx8KHIuc3R5bGUuZGlzcGxheT1cIlwiKSxcIlwiPT09ci5zdHlsZS5kaXNwbGF5JiZubihyKSYmKG9bYV09Yi5fZGF0YShyLFwib2xkZGlzcGxheVwiLHVuKHIubm9kZU5hbWUpKSkpOm9bYV18fChpPW5uKHIpLChuJiZcIm5vbmVcIiE9PW58fCFpKSYmYi5fZGF0YShyLFwib2xkZGlzcGxheVwiLGk/bjpiLmNzcyhyLFwiZGlzcGxheVwiKSkpKTtmb3IoYT0wO3M+YTthKyspcj1lW2FdLHIuc3R5bGUmJih0JiZcIm5vbmVcIiE9PXIuc3R5bGUuZGlzcGxheSYmXCJcIiE9PXIuc3R5bGUuZGlzcGxheXx8KHIuc3R5bGUuZGlzcGxheT10P29bYV18fFwiXCI6XCJub25lXCIpKTtyZXR1cm4gZX1iLmZuLmV4dGVuZCh7Y3NzOmZ1bmN0aW9uKGUsbil7cmV0dXJuIGIuYWNjZXNzKHRoaXMsZnVuY3Rpb24oZSxuLHIpe3ZhciBpLG8sYT17fSxzPTA7aWYoYi5pc0FycmF5KG4pKXtmb3Iobz1SdChlKSxpPW4ubGVuZ3RoO2k+cztzKyspYVtuW3NdXT1iLmNzcyhlLG5bc10sITEsbyk7cmV0dXJuIGF9cmV0dXJuIHIhPT10P2Iuc3R5bGUoZSxuLHIpOmIuY3NzKGUsbil9LGUsbixhcmd1bWVudHMubGVuZ3RoPjEpfSxzaG93OmZ1bmN0aW9uKCl7cmV0dXJuIHJuKHRoaXMsITApfSxoaWRlOmZ1bmN0aW9uKCl7cmV0dXJuIHJuKHRoaXMpfSx0b2dnbGU6ZnVuY3Rpb24oZSl7dmFyIHQ9XCJib29sZWFuXCI9PXR5cGVvZiBlO3JldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oKXsodD9lOm5uKHRoaXMpKT9iKHRoaXMpLnNob3coKTpiKHRoaXMpLmhpZGUoKX0pfX0pLGIuZXh0ZW5kKHtjc3NIb29rczp7b3BhY2l0eTp7Z2V0OmZ1bmN0aW9uKGUsdCl7aWYodCl7dmFyIG49V3QoZSxcIm9wYWNpdHlcIik7cmV0dXJuXCJcIj09PW4/XCIxXCI6bn19fX0sY3NzTnVtYmVyOntjb2x1bW5Db3VudDohMCxmaWxsT3BhY2l0eTohMCxmb250V2VpZ2h0OiEwLGxpbmVIZWlnaHQ6ITAsb3BhY2l0eTohMCxvcnBoYW5zOiEwLHdpZG93czohMCx6SW5kZXg6ITAsem9vbTohMH0sY3NzUHJvcHM6e1wiZmxvYXRcIjpiLnN1cHBvcnQuY3NzRmxvYXQ/XCJjc3NGbG9hdFwiOlwic3R5bGVGbG9hdFwifSxzdHlsZTpmdW5jdGlvbihlLG4scixpKXtpZihlJiYzIT09ZS5ub2RlVHlwZSYmOCE9PWUubm9kZVR5cGUmJmUuc3R5bGUpe3ZhciBvLGEscyx1PWIuY2FtZWxDYXNlKG4pLGw9ZS5zdHlsZTtpZihuPWIuY3NzUHJvcHNbdV18fChiLmNzc1Byb3BzW3VdPXRuKGwsdSkpLHM9Yi5jc3NIb29rc1tuXXx8Yi5jc3NIb29rc1t1XSxyPT09dClyZXR1cm4gcyYmXCJnZXRcImluIHMmJihvPXMuZ2V0KGUsITEsaSkpIT09dD9vOmxbbl07aWYoYT10eXBlb2YgcixcInN0cmluZ1wiPT09YSYmKG89SnQuZXhlYyhyKSkmJihyPShvWzFdKzEpKm9bMl0rcGFyc2VGbG9hdChiLmNzcyhlLG4pKSxhPVwibnVtYmVyXCIpLCEobnVsbD09cnx8XCJudW1iZXJcIj09PWEmJmlzTmFOKHIpfHwoXCJudW1iZXJcIiE9PWF8fGIuY3NzTnVtYmVyW3VdfHwocis9XCJweFwiKSxiLnN1cHBvcnQuY2xlYXJDbG9uZVN0eWxlfHxcIlwiIT09cnx8MCE9PW4uaW5kZXhPZihcImJhY2tncm91bmRcIil8fChsW25dPVwiaW5oZXJpdFwiKSxzJiZcInNldFwiaW4gcyYmKHI9cy5zZXQoZSxyLGkpKT09PXQpKSl0cnl7bFtuXT1yfWNhdGNoKGMpe319fSxjc3M6ZnVuY3Rpb24oZSxuLHIsaSl7dmFyIG8sYSxzLHU9Yi5jYW1lbENhc2Uobik7cmV0dXJuIG49Yi5jc3NQcm9wc1t1XXx8KGIuY3NzUHJvcHNbdV09dG4oZS5zdHlsZSx1KSkscz1iLmNzc0hvb2tzW25dfHxiLmNzc0hvb2tzW3VdLHMmJlwiZ2V0XCJpbiBzJiYoYT1zLmdldChlLCEwLHIpKSxhPT09dCYmKGE9V3QoZSxuLGkpKSxcIm5vcm1hbFwiPT09YSYmbiBpbiBLdCYmKGE9S3Rbbl0pLFwiXCI9PT1yfHxyPyhvPXBhcnNlRmxvYXQoYSkscj09PSEwfHxiLmlzTnVtZXJpYyhvKT9vfHwwOmEpOmF9LHN3YXA6ZnVuY3Rpb24oZSx0LG4scil7dmFyIGksbyxhPXt9O2ZvcihvIGluIHQpYVtvXT1lLnN0eWxlW29dLGUuc3R5bGVbb109dFtvXTtpPW4uYXBwbHkoZSxyfHxbXSk7Zm9yKG8gaW4gdCllLnN0eWxlW29dPWFbb107cmV0dXJuIGl9fSksZS5nZXRDb21wdXRlZFN0eWxlPyhSdD1mdW5jdGlvbih0KXtyZXR1cm4gZS5nZXRDb21wdXRlZFN0eWxlKHQsbnVsbCl9LFd0PWZ1bmN0aW9uKGUsbixyKXt2YXIgaSxvLGEscz1yfHxSdChlKSx1PXM/cy5nZXRQcm9wZXJ0eVZhbHVlKG4pfHxzW25dOnQsbD1lLnN0eWxlO3JldHVybiBzJiYoXCJcIiE9PXV8fGIuY29udGFpbnMoZS5vd25lckRvY3VtZW50LGUpfHwodT1iLnN0eWxlKGUsbikpLFl0LnRlc3QodSkmJlV0LnRlc3QobikmJihpPWwud2lkdGgsbz1sLm1pbldpZHRoLGE9bC5tYXhXaWR0aCxsLm1pbldpZHRoPWwubWF4V2lkdGg9bC53aWR0aD11LHU9cy53aWR0aCxsLndpZHRoPWksbC5taW5XaWR0aD1vLGwubWF4V2lkdGg9YSkpLHV9KTpvLmRvY3VtZW50RWxlbWVudC5jdXJyZW50U3R5bGUmJihSdD1mdW5jdGlvbihlKXtyZXR1cm4gZS5jdXJyZW50U3R5bGV9LFd0PWZ1bmN0aW9uKGUsbixyKXt2YXIgaSxvLGEscz1yfHxSdChlKSx1PXM/c1tuXTp0LGw9ZS5zdHlsZTtyZXR1cm4gbnVsbD09dSYmbCYmbFtuXSYmKHU9bFtuXSksWXQudGVzdCh1KSYmIXp0LnRlc3QobikmJihpPWwubGVmdCxvPWUucnVudGltZVN0eWxlLGE9byYmby5sZWZ0LGEmJihvLmxlZnQ9ZS5jdXJyZW50U3R5bGUubGVmdCksbC5sZWZ0PVwiZm9udFNpemVcIj09PW4/XCIxZW1cIjp1LHU9bC5waXhlbExlZnQrXCJweFwiLGwubGVmdD1pLGEmJihvLmxlZnQ9YSkpLFwiXCI9PT11P1wiYXV0b1wiOnV9KTtmdW5jdGlvbiBvbihlLHQsbil7dmFyIHI9VnQuZXhlYyh0KTtyZXR1cm4gcj9NYXRoLm1heCgwLHJbMV0tKG58fDApKSsoclsyXXx8XCJweFwiKTp0fWZ1bmN0aW9uIGFuKGUsdCxuLHIsaSl7dmFyIG89bj09PShyP1wiYm9yZGVyXCI6XCJjb250ZW50XCIpPzQ6XCJ3aWR0aFwiPT09dD8xOjAsYT0wO2Zvcig7ND5vO28rPTIpXCJtYXJnaW5cIj09PW4mJihhKz1iLmNzcyhlLG4rWnRbb10sITAsaSkpLHI/KFwiY29udGVudFwiPT09biYmKGEtPWIuY3NzKGUsXCJwYWRkaW5nXCIrWnRbb10sITAsaSkpLFwibWFyZ2luXCIhPT1uJiYoYS09Yi5jc3MoZSxcImJvcmRlclwiK1p0W29dK1wiV2lkdGhcIiwhMCxpKSkpOihhKz1iLmNzcyhlLFwicGFkZGluZ1wiK1p0W29dLCEwLGkpLFwicGFkZGluZ1wiIT09biYmKGErPWIuY3NzKGUsXCJib3JkZXJcIitadFtvXStcIldpZHRoXCIsITAsaSkpKTtyZXR1cm4gYX1mdW5jdGlvbiBzbihlLHQsbil7dmFyIHI9ITAsaT1cIndpZHRoXCI9PT10P2Uub2Zmc2V0V2lkdGg6ZS5vZmZzZXRIZWlnaHQsbz1SdChlKSxhPWIuc3VwcG9ydC5ib3hTaXppbmcmJlwiYm9yZGVyLWJveFwiPT09Yi5jc3MoZSxcImJveFNpemluZ1wiLCExLG8pO2lmKDA+PWl8fG51bGw9PWkpe2lmKGk9V3QoZSx0LG8pLCgwPml8fG51bGw9PWkpJiYoaT1lLnN0eWxlW3RdKSxZdC50ZXN0KGkpKXJldHVybiBpO3I9YSYmKGIuc3VwcG9ydC5ib3hTaXppbmdSZWxpYWJsZXx8aT09PWUuc3R5bGVbdF0pLGk9cGFyc2VGbG9hdChpKXx8MH1yZXR1cm4gaSthbihlLHQsbnx8KGE/XCJib3JkZXJcIjpcImNvbnRlbnRcIikscixvKStcInB4XCJ9ZnVuY3Rpb24gdW4oZSl7dmFyIHQ9byxuPUd0W2VdO3JldHVybiBufHwobj1sbihlLHQpLFwibm9uZVwiIT09biYmbnx8KFB0PShQdHx8YihcIjxpZnJhbWUgZnJhbWVib3JkZXI9JzAnIHdpZHRoPScwJyBoZWlnaHQ9JzAnLz5cIikuY3NzKFwiY3NzVGV4dFwiLFwiZGlzcGxheTpibG9jayAhaW1wb3J0YW50XCIpKS5hcHBlbmRUbyh0LmRvY3VtZW50RWxlbWVudCksdD0oUHRbMF0uY29udGVudFdpbmRvd3x8UHRbMF0uY29udGVudERvY3VtZW50KS5kb2N1bWVudCx0LndyaXRlKFwiPCFkb2N0eXBlIGh0bWw+PGh0bWw+PGJvZHk+XCIpLHQuY2xvc2UoKSxuPWxuKGUsdCksUHQuZGV0YWNoKCkpLEd0W2VdPW4pLG59ZnVuY3Rpb24gbG4oZSx0KXt2YXIgbj1iKHQuY3JlYXRlRWxlbWVudChlKSkuYXBwZW5kVG8odC5ib2R5KSxyPWIuY3NzKG5bMF0sXCJkaXNwbGF5XCIpO3JldHVybiBuLnJlbW92ZSgpLHJ9Yi5lYWNoKFtcImhlaWdodFwiLFwid2lkdGhcIl0sZnVuY3Rpb24oZSxuKXtiLmNzc0hvb2tzW25dPXtnZXQ6ZnVuY3Rpb24oZSxyLGkpe3JldHVybiByPzA9PT1lLm9mZnNldFdpZHRoJiZYdC50ZXN0KGIuY3NzKGUsXCJkaXNwbGF5XCIpKT9iLnN3YXAoZSxRdCxmdW5jdGlvbigpe3JldHVybiBzbihlLG4saSl9KTpzbihlLG4saSk6dH0sc2V0OmZ1bmN0aW9uKGUsdCxyKXt2YXIgaT1yJiZSdChlKTtyZXR1cm4gb24oZSx0LHI/YW4oZSxuLHIsYi5zdXBwb3J0LmJveFNpemluZyYmXCJib3JkZXItYm94XCI9PT1iLmNzcyhlLFwiYm94U2l6aW5nXCIsITEsaSksaSk6MCl9fX0pLGIuc3VwcG9ydC5vcGFjaXR5fHwoYi5jc3NIb29rcy5vcGFjaXR5PXtnZXQ6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gSXQudGVzdCgodCYmZS5jdXJyZW50U3R5bGU/ZS5jdXJyZW50U3R5bGUuZmlsdGVyOmUuc3R5bGUuZmlsdGVyKXx8XCJcIik/LjAxKnBhcnNlRmxvYXQoUmVnRXhwLiQxKStcIlwiOnQ/XCIxXCI6XCJcIn0sc2V0OmZ1bmN0aW9uKGUsdCl7dmFyIG49ZS5zdHlsZSxyPWUuY3VycmVudFN0eWxlLGk9Yi5pc051bWVyaWModCk/XCJhbHBoYShvcGFjaXR5PVwiKzEwMCp0K1wiKVwiOlwiXCIsbz1yJiZyLmZpbHRlcnx8bi5maWx0ZXJ8fFwiXCI7bi56b29tPTEsKHQ+PTF8fFwiXCI9PT10KSYmXCJcIj09PWIudHJpbShvLnJlcGxhY2UoJHQsXCJcIikpJiZuLnJlbW92ZUF0dHJpYnV0ZSYmKG4ucmVtb3ZlQXR0cmlidXRlKFwiZmlsdGVyXCIpLFwiXCI9PT10fHxyJiYhci5maWx0ZXIpfHwobi5maWx0ZXI9JHQudGVzdChvKT9vLnJlcGxhY2UoJHQsaSk6bytcIiBcIitpKX19KSxiKGZ1bmN0aW9uKCl7Yi5zdXBwb3J0LnJlbGlhYmxlTWFyZ2luUmlnaHR8fChiLmNzc0hvb2tzLm1hcmdpblJpZ2h0PXtnZXQ6ZnVuY3Rpb24oZSxuKXtyZXR1cm4gbj9iLnN3YXAoZSx7ZGlzcGxheTpcImlubGluZS1ibG9ja1wifSxXdCxbZSxcIm1hcmdpblJpZ2h0XCJdKTp0fX0pLCFiLnN1cHBvcnQucGl4ZWxQb3NpdGlvbiYmYi5mbi5wb3NpdGlvbiYmYi5lYWNoKFtcInRvcFwiLFwibGVmdFwiXSxmdW5jdGlvbihlLG4pe2IuY3NzSG9va3Nbbl09e2dldDpmdW5jdGlvbihlLHIpe3JldHVybiByPyhyPVd0KGUsbiksWXQudGVzdChyKT9iKGUpLnBvc2l0aW9uKClbbl0rXCJweFwiOnIpOnR9fX0pfSksYi5leHByJiZiLmV4cHIuZmlsdGVycyYmKGIuZXhwci5maWx0ZXJzLmhpZGRlbj1mdW5jdGlvbihlKXtyZXR1cm4gMD49ZS5vZmZzZXRXaWR0aCYmMD49ZS5vZmZzZXRIZWlnaHR8fCFiLnN1cHBvcnQucmVsaWFibGVIaWRkZW5PZmZzZXRzJiZcIm5vbmVcIj09PShlLnN0eWxlJiZlLnN0eWxlLmRpc3BsYXl8fGIuY3NzKGUsXCJkaXNwbGF5XCIpKX0sYi5leHByLmZpbHRlcnMudmlzaWJsZT1mdW5jdGlvbihlKXtyZXR1cm4hYi5leHByLmZpbHRlcnMuaGlkZGVuKGUpfSksYi5lYWNoKHttYXJnaW46XCJcIixwYWRkaW5nOlwiXCIsYm9yZGVyOlwiV2lkdGhcIn0sZnVuY3Rpb24oZSx0KXtiLmNzc0hvb2tzW2UrdF09e2V4cGFuZDpmdW5jdGlvbihuKXt2YXIgcj0wLGk9e30sbz1cInN0cmluZ1wiPT10eXBlb2Ygbj9uLnNwbGl0KFwiIFwiKTpbbl07Zm9yKDs0PnI7cisrKWlbZStadFtyXSt0XT1vW3JdfHxvW3ItMl18fG9bMF07cmV0dXJuIGl9fSxVdC50ZXN0KGUpfHwoYi5jc3NIb29rc1tlK3RdLnNldD1vbil9KTt2YXIgY249LyUyMC9nLHBuPS9cXFtcXF0kLyxmbj0vXFxyP1xcbi9nLGRuPS9eKD86c3VibWl0fGJ1dHRvbnxpbWFnZXxyZXNldHxmaWxlKSQvaSxobj0vXig/OmlucHV0fHNlbGVjdHx0ZXh0YXJlYXxrZXlnZW4pL2k7Yi5mbi5leHRlbmQoe3NlcmlhbGl6ZTpmdW5jdGlvbigpe3JldHVybiBiLnBhcmFtKHRoaXMuc2VyaWFsaXplQXJyYXkoKSl9LHNlcmlhbGl6ZUFycmF5OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMubWFwKGZ1bmN0aW9uKCl7dmFyIGU9Yi5wcm9wKHRoaXMsXCJlbGVtZW50c1wiKTtyZXR1cm4gZT9iLm1ha2VBcnJheShlKTp0aGlzfSkuZmlsdGVyKGZ1bmN0aW9uKCl7dmFyIGU9dGhpcy50eXBlO3JldHVybiB0aGlzLm5hbWUmJiFiKHRoaXMpLmlzKFwiOmRpc2FibGVkXCIpJiZobi50ZXN0KHRoaXMubm9kZU5hbWUpJiYhZG4udGVzdChlKSYmKHRoaXMuY2hlY2tlZHx8IU50LnRlc3QoZSkpfSkubWFwKGZ1bmN0aW9uKGUsdCl7dmFyIG49Yih0aGlzKS52YWwoKTtyZXR1cm4gbnVsbD09bj9udWxsOmIuaXNBcnJheShuKT9iLm1hcChuLGZ1bmN0aW9uKGUpe3JldHVybntuYW1lOnQubmFtZSx2YWx1ZTplLnJlcGxhY2UoZm4sXCJcXHJcXG5cIil9fSk6e25hbWU6dC5uYW1lLHZhbHVlOm4ucmVwbGFjZShmbixcIlxcclxcblwiKX19KS5nZXQoKX19KSxiLnBhcmFtPWZ1bmN0aW9uKGUsbil7dmFyIHIsaT1bXSxvPWZ1bmN0aW9uKGUsdCl7dD1iLmlzRnVuY3Rpb24odCk/dCgpOm51bGw9PXQ/XCJcIjp0LGlbaS5sZW5ndGhdPWVuY29kZVVSSUNvbXBvbmVudChlKStcIj1cIitlbmNvZGVVUklDb21wb25lbnQodCl9O2lmKG49PT10JiYobj1iLmFqYXhTZXR0aW5ncyYmYi5hamF4U2V0dGluZ3MudHJhZGl0aW9uYWwpLGIuaXNBcnJheShlKXx8ZS5qcXVlcnkmJiFiLmlzUGxhaW5PYmplY3QoZSkpYi5lYWNoKGUsZnVuY3Rpb24oKXtvKHRoaXMubmFtZSx0aGlzLnZhbHVlKX0pO2Vsc2UgZm9yKHIgaW4gZSlnbihyLGVbcl0sbixvKTtyZXR1cm4gaS5qb2luKFwiJlwiKS5yZXBsYWNlKGNuLFwiK1wiKX07ZnVuY3Rpb24gZ24oZSx0LG4scil7dmFyIGk7aWYoYi5pc0FycmF5KHQpKWIuZWFjaCh0LGZ1bmN0aW9uKHQsaSl7bnx8cG4udGVzdChlKT9yKGUsaSk6Z24oZStcIltcIisoXCJvYmplY3RcIj09dHlwZW9mIGk/dDpcIlwiKStcIl1cIixpLG4scil9KTtlbHNlIGlmKG58fFwib2JqZWN0XCIhPT1iLnR5cGUodCkpcihlLHQpO2Vsc2UgZm9yKGkgaW4gdClnbihlK1wiW1wiK2krXCJdXCIsdFtpXSxuLHIpfWIuZWFjaChcImJsdXIgZm9jdXMgZm9jdXNpbiBmb2N1c291dCBsb2FkIHJlc2l6ZSBzY3JvbGwgdW5sb2FkIGNsaWNrIGRibGNsaWNrIG1vdXNlZG93biBtb3VzZXVwIG1vdXNlbW92ZSBtb3VzZW92ZXIgbW91c2VvdXQgbW91c2VlbnRlciBtb3VzZWxlYXZlIGNoYW5nZSBzZWxlY3Qgc3VibWl0IGtleWRvd24ga2V5cHJlc3Mga2V5dXAgZXJyb3IgY29udGV4dG1lbnVcIi5zcGxpdChcIiBcIiksZnVuY3Rpb24oZSx0KXtiLmZuW3RdPWZ1bmN0aW9uKGUsbil7cmV0dXJuIGFyZ3VtZW50cy5sZW5ndGg+MD90aGlzLm9uKHQsbnVsbCxlLG4pOnRoaXMudHJpZ2dlcih0KX19KSxiLmZuLmhvdmVyPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIHRoaXMubW91c2VlbnRlcihlKS5tb3VzZWxlYXZlKHR8fGUpfTt2YXIgbW4seW4sdm49Yi5ub3coKSxibj0vXFw/Lyx4bj0vIy4qJC8sd249LyhbPyZdKV89W14mXSovLFRuPS9eKC4qPyk6WyBcXHRdKihbXlxcclxcbl0qKVxccj8kL2dtLE5uPS9eKD86YWJvdXR8YXBwfGFwcC1zdG9yYWdlfC4rLWV4dGVuc2lvbnxmaWxlfHJlc3x3aWRnZXQpOiQvLENuPS9eKD86R0VUfEhFQUQpJC8sa249L15cXC9cXC8vLEVuPS9eKFtcXHcuKy1dKzopKD86XFwvXFwvKFteXFwvPyM6XSopKD86OihcXGQrKXwpfCkvLFNuPWIuZm4ubG9hZCxBbj17fSxqbj17fSxEbj1cIiovXCIuY29uY2F0KFwiKlwiKTt0cnl7eW49YS5ocmVmfWNhdGNoKExuKXt5bj1vLmNyZWF0ZUVsZW1lbnQoXCJhXCIpLHluLmhyZWY9XCJcIix5bj15bi5ocmVmfW1uPUVuLmV4ZWMoeW4udG9Mb3dlckNhc2UoKSl8fFtdO2Z1bmN0aW9uIEhuKGUpe3JldHVybiBmdW5jdGlvbih0LG4pe1wic3RyaW5nXCIhPXR5cGVvZiB0JiYobj10LHQ9XCIqXCIpO3ZhciByLGk9MCxvPXQudG9Mb3dlckNhc2UoKS5tYXRjaCh3KXx8W107aWYoYi5pc0Z1bmN0aW9uKG4pKXdoaWxlKHI9b1tpKytdKVwiK1wiPT09clswXT8ocj1yLnNsaWNlKDEpfHxcIipcIiwoZVtyXT1lW3JdfHxbXSkudW5zaGlmdChuKSk6KGVbcl09ZVtyXXx8W10pLnB1c2gobil9fWZ1bmN0aW9uIHFuKGUsbixyLGkpe3ZhciBvPXt9LGE9ZT09PWpuO2Z1bmN0aW9uIHModSl7dmFyIGw7cmV0dXJuIG9bdV09ITAsYi5lYWNoKGVbdV18fFtdLGZ1bmN0aW9uKGUsdSl7dmFyIGM9dShuLHIsaSk7cmV0dXJuXCJzdHJpbmdcIiE9dHlwZW9mIGN8fGF8fG9bY10/YT8hKGw9Yyk6dDoobi5kYXRhVHlwZXMudW5zaGlmdChjKSxzKGMpLCExKX0pLGx9cmV0dXJuIHMobi5kYXRhVHlwZXNbMF0pfHwhb1tcIipcIl0mJnMoXCIqXCIpfWZ1bmN0aW9uIE1uKGUsbil7dmFyIHIsaSxvPWIuYWpheFNldHRpbmdzLmZsYXRPcHRpb25zfHx7fTtmb3IoaSBpbiBuKW5baV0hPT10JiYoKG9baV0/ZTpyfHwocj17fSkpW2ldPW5baV0pO3JldHVybiByJiZiLmV4dGVuZCghMCxlLHIpLGV9Yi5mbi5sb2FkPWZ1bmN0aW9uKGUsbixyKXtpZihcInN0cmluZ1wiIT10eXBlb2YgZSYmU24pcmV0dXJuIFNuLmFwcGx5KHRoaXMsYXJndW1lbnRzKTt2YXIgaSxvLGEscz10aGlzLHU9ZS5pbmRleE9mKFwiIFwiKTtyZXR1cm4gdT49MCYmKGk9ZS5zbGljZSh1LGUubGVuZ3RoKSxlPWUuc2xpY2UoMCx1KSksYi5pc0Z1bmN0aW9uKG4pPyhyPW4sbj10KTpuJiZcIm9iamVjdFwiPT10eXBlb2YgbiYmKGE9XCJQT1NUXCIpLHMubGVuZ3RoPjAmJmIuYWpheCh7dXJsOmUsdHlwZTphLGRhdGFUeXBlOlwiaHRtbFwiLGRhdGE6bn0pLmRvbmUoZnVuY3Rpb24oZSl7bz1hcmd1bWVudHMscy5odG1sKGk/YihcIjxkaXY+XCIpLmFwcGVuZChiLnBhcnNlSFRNTChlKSkuZmluZChpKTplKX0pLmNvbXBsZXRlKHImJmZ1bmN0aW9uKGUsdCl7cy5lYWNoKHIsb3x8W2UucmVzcG9uc2VUZXh0LHQsZV0pfSksdGhpc30sYi5lYWNoKFtcImFqYXhTdGFydFwiLFwiYWpheFN0b3BcIixcImFqYXhDb21wbGV0ZVwiLFwiYWpheEVycm9yXCIsXCJhamF4U3VjY2Vzc1wiLFwiYWpheFNlbmRcIl0sZnVuY3Rpb24oZSx0KXtiLmZuW3RdPWZ1bmN0aW9uKGUpe3JldHVybiB0aGlzLm9uKHQsZSl9fSksYi5lYWNoKFtcImdldFwiLFwicG9zdFwiXSxmdW5jdGlvbihlLG4pe2Jbbl09ZnVuY3Rpb24oZSxyLGksbyl7cmV0dXJuIGIuaXNGdW5jdGlvbihyKSYmKG89b3x8aSxpPXIscj10KSxiLmFqYXgoe3VybDplLHR5cGU6bixkYXRhVHlwZTpvLGRhdGE6cixzdWNjZXNzOml9KX19KSxiLmV4dGVuZCh7YWN0aXZlOjAsbGFzdE1vZGlmaWVkOnt9LGV0YWc6e30sYWpheFNldHRpbmdzOnt1cmw6eW4sdHlwZTpcIkdFVFwiLGlzTG9jYWw6Tm4udGVzdChtblsxXSksZ2xvYmFsOiEwLHByb2Nlc3NEYXRhOiEwLGFzeW5jOiEwLGNvbnRlbnRUeXBlOlwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04XCIsYWNjZXB0czp7XCIqXCI6RG4sdGV4dDpcInRleHQvcGxhaW5cIixodG1sOlwidGV4dC9odG1sXCIseG1sOlwiYXBwbGljYXRpb24veG1sLCB0ZXh0L3htbFwiLGpzb246XCJhcHBsaWNhdGlvbi9qc29uLCB0ZXh0L2phdmFzY3JpcHRcIn0sY29udGVudHM6e3htbDoveG1sLyxodG1sOi9odG1sLyxqc29uOi9qc29uL30scmVzcG9uc2VGaWVsZHM6e3htbDpcInJlc3BvbnNlWE1MXCIsdGV4dDpcInJlc3BvbnNlVGV4dFwifSxjb252ZXJ0ZXJzOntcIiogdGV4dFwiOmUuU3RyaW5nLFwidGV4dCBodG1sXCI6ITAsXCJ0ZXh0IGpzb25cIjpiLnBhcnNlSlNPTixcInRleHQgeG1sXCI6Yi5wYXJzZVhNTH0sZmxhdE9wdGlvbnM6e3VybDohMCxjb250ZXh0OiEwfX0sYWpheFNldHVwOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIHQ/TW4oTW4oZSxiLmFqYXhTZXR0aW5ncyksdCk6TW4oYi5hamF4U2V0dGluZ3MsZSl9LGFqYXhQcmVmaWx0ZXI6SG4oQW4pLGFqYXhUcmFuc3BvcnQ6SG4oam4pLGFqYXg6ZnVuY3Rpb24oZSxuKXtcIm9iamVjdFwiPT10eXBlb2YgZSYmKG49ZSxlPXQpLG49bnx8e307dmFyIHIsaSxvLGEscyx1LGwsYyxwPWIuYWpheFNldHVwKHt9LG4pLGY9cC5jb250ZXh0fHxwLGQ9cC5jb250ZXh0JiYoZi5ub2RlVHlwZXx8Zi5qcXVlcnkpP2IoZik6Yi5ldmVudCxoPWIuRGVmZXJyZWQoKSxnPWIuQ2FsbGJhY2tzKFwib25jZSBtZW1vcnlcIiksbT1wLnN0YXR1c0NvZGV8fHt9LHk9e30sdj17fSx4PTAsVD1cImNhbmNlbGVkXCIsTj17cmVhZHlTdGF0ZTowLGdldFJlc3BvbnNlSGVhZGVyOmZ1bmN0aW9uKGUpe3ZhciB0O2lmKDI9PT14KXtpZighYyl7Yz17fTt3aGlsZSh0PVRuLmV4ZWMoYSkpY1t0WzFdLnRvTG93ZXJDYXNlKCldPXRbMl19dD1jW2UudG9Mb3dlckNhc2UoKV19cmV0dXJuIG51bGw9PXQ/bnVsbDp0fSxnZXRBbGxSZXNwb25zZUhlYWRlcnM6ZnVuY3Rpb24oKXtyZXR1cm4gMj09PXg/YTpudWxsfSxzZXRSZXF1ZXN0SGVhZGVyOmZ1bmN0aW9uKGUsdCl7dmFyIG49ZS50b0xvd2VyQ2FzZSgpO3JldHVybiB4fHwoZT12W25dPXZbbl18fGUseVtlXT10KSx0aGlzfSxvdmVycmlkZU1pbWVUeXBlOmZ1bmN0aW9uKGUpe3JldHVybiB4fHwocC5taW1lVHlwZT1lKSx0aGlzfSxzdGF0dXNDb2RlOmZ1bmN0aW9uKGUpe3ZhciB0O2lmKGUpaWYoMj54KWZvcih0IGluIGUpbVt0XT1bbVt0XSxlW3RdXTtlbHNlIE4uYWx3YXlzKGVbTi5zdGF0dXNdKTtyZXR1cm4gdGhpc30sYWJvcnQ6ZnVuY3Rpb24oZSl7dmFyIHQ9ZXx8VDtyZXR1cm4gbCYmbC5hYm9ydCh0KSxrKDAsdCksdGhpc319O2lmKGgucHJvbWlzZShOKS5jb21wbGV0ZT1nLmFkZCxOLnN1Y2Nlc3M9Ti5kb25lLE4uZXJyb3I9Ti5mYWlsLHAudXJsPSgoZXx8cC51cmx8fHluKStcIlwiKS5yZXBsYWNlKHhuLFwiXCIpLnJlcGxhY2Uoa24sbW5bMV0rXCIvL1wiKSxwLnR5cGU9bi5tZXRob2R8fG4udHlwZXx8cC5tZXRob2R8fHAudHlwZSxwLmRhdGFUeXBlcz1iLnRyaW0ocC5kYXRhVHlwZXx8XCIqXCIpLnRvTG93ZXJDYXNlKCkubWF0Y2godyl8fFtcIlwiXSxudWxsPT1wLmNyb3NzRG9tYWluJiYocj1Fbi5leGVjKHAudXJsLnRvTG93ZXJDYXNlKCkpLHAuY3Jvc3NEb21haW49ISghcnx8clsxXT09PW1uWzFdJiZyWzJdPT09bW5bMl0mJihyWzNdfHwoXCJodHRwOlwiPT09clsxXT84MDo0NDMpKT09KG1uWzNdfHwoXCJodHRwOlwiPT09bW5bMV0/ODA6NDQzKSkpKSxwLmRhdGEmJnAucHJvY2Vzc0RhdGEmJlwic3RyaW5nXCIhPXR5cGVvZiBwLmRhdGEmJihwLmRhdGE9Yi5wYXJhbShwLmRhdGEscC50cmFkaXRpb25hbCkpLHFuKEFuLHAsbixOKSwyPT09eClyZXR1cm4gTjt1PXAuZ2xvYmFsLHUmJjA9PT1iLmFjdGl2ZSsrJiZiLmV2ZW50LnRyaWdnZXIoXCJhamF4U3RhcnRcIikscC50eXBlPXAudHlwZS50b1VwcGVyQ2FzZSgpLHAuaGFzQ29udGVudD0hQ24udGVzdChwLnR5cGUpLG89cC51cmwscC5oYXNDb250ZW50fHwocC5kYXRhJiYobz1wLnVybCs9KGJuLnRlc3Qobyk/XCImXCI6XCI/XCIpK3AuZGF0YSxkZWxldGUgcC5kYXRhKSxwLmNhY2hlPT09ITEmJihwLnVybD13bi50ZXN0KG8pP28ucmVwbGFjZSh3bixcIiQxXz1cIit2bisrKTpvKyhibi50ZXN0KG8pP1wiJlwiOlwiP1wiKStcIl89XCIrdm4rKykpLHAuaWZNb2RpZmllZCYmKGIubGFzdE1vZGlmaWVkW29dJiZOLnNldFJlcXVlc3RIZWFkZXIoXCJJZi1Nb2RpZmllZC1TaW5jZVwiLGIubGFzdE1vZGlmaWVkW29dKSxiLmV0YWdbb10mJk4uc2V0UmVxdWVzdEhlYWRlcihcIklmLU5vbmUtTWF0Y2hcIixiLmV0YWdbb10pKSwocC5kYXRhJiZwLmhhc0NvbnRlbnQmJnAuY29udGVudFR5cGUhPT0hMXx8bi5jb250ZW50VHlwZSkmJk4uc2V0UmVxdWVzdEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLHAuY29udGVudFR5cGUpLE4uc2V0UmVxdWVzdEhlYWRlcihcIkFjY2VwdFwiLHAuZGF0YVR5cGVzWzBdJiZwLmFjY2VwdHNbcC5kYXRhVHlwZXNbMF1dP3AuYWNjZXB0c1twLmRhdGFUeXBlc1swXV0rKFwiKlwiIT09cC5kYXRhVHlwZXNbMF0/XCIsIFwiK0RuK1wiOyBxPTAuMDFcIjpcIlwiKTpwLmFjY2VwdHNbXCIqXCJdKTtmb3IoaSBpbiBwLmhlYWRlcnMpTi5zZXRSZXF1ZXN0SGVhZGVyKGkscC5oZWFkZXJzW2ldKTtpZihwLmJlZm9yZVNlbmQmJihwLmJlZm9yZVNlbmQuY2FsbChmLE4scCk9PT0hMXx8Mj09PXgpKXJldHVybiBOLmFib3J0KCk7VD1cImFib3J0XCI7Zm9yKGkgaW57c3VjY2VzczoxLGVycm9yOjEsY29tcGxldGU6MX0pTltpXShwW2ldKTtpZihsPXFuKGpuLHAsbixOKSl7Ti5yZWFkeVN0YXRlPTEsdSYmZC50cmlnZ2VyKFwiYWpheFNlbmRcIixbTixwXSkscC5hc3luYyYmcC50aW1lb3V0PjAmJihzPXNldFRpbWVvdXQoZnVuY3Rpb24oKXtOLmFib3J0KFwidGltZW91dFwiKX0scC50aW1lb3V0KSk7dHJ5e3g9MSxsLnNlbmQoeSxrKX1jYXRjaChDKXtpZighKDI+eCkpdGhyb3cgQztrKC0xLEMpfX1lbHNlIGsoLTEsXCJObyBUcmFuc3BvcnRcIik7ZnVuY3Rpb24gayhlLG4scixpKXt2YXIgYyx5LHYsdyxULEM9bjsyIT09eCYmKHg9MixzJiZjbGVhclRpbWVvdXQocyksbD10LGE9aXx8XCJcIixOLnJlYWR5U3RhdGU9ZT4wPzQ6MCxyJiYodz1fbihwLE4scikpLGU+PTIwMCYmMzAwPmV8fDMwND09PWU/KHAuaWZNb2RpZmllZCYmKFQ9Ti5nZXRSZXNwb25zZUhlYWRlcihcIkxhc3QtTW9kaWZpZWRcIiksVCYmKGIubGFzdE1vZGlmaWVkW29dPVQpLFQ9Ti5nZXRSZXNwb25zZUhlYWRlcihcImV0YWdcIiksVCYmKGIuZXRhZ1tvXT1UKSksMjA0PT09ZT8oYz0hMCxDPVwibm9jb250ZW50XCIpOjMwND09PWU/KGM9ITAsQz1cIm5vdG1vZGlmaWVkXCIpOihjPUZuKHAsdyksQz1jLnN0YXRlLHk9Yy5kYXRhLHY9Yy5lcnJvcixjPSF2KSk6KHY9QywoZXx8IUMpJiYoQz1cImVycm9yXCIsMD5lJiYoZT0wKSkpLE4uc3RhdHVzPWUsTi5zdGF0dXNUZXh0PShufHxDKStcIlwiLGM/aC5yZXNvbHZlV2l0aChmLFt5LEMsTl0pOmgucmVqZWN0V2l0aChmLFtOLEMsdl0pLE4uc3RhdHVzQ29kZShtKSxtPXQsdSYmZC50cmlnZ2VyKGM/XCJhamF4U3VjY2Vzc1wiOlwiYWpheEVycm9yXCIsW04scCxjP3k6dl0pLGcuZmlyZVdpdGgoZixbTixDXSksdSYmKGQudHJpZ2dlcihcImFqYXhDb21wbGV0ZVwiLFtOLHBdKSwtLWIuYWN0aXZlfHxiLmV2ZW50LnRyaWdnZXIoXCJhamF4U3RvcFwiKSkpfXJldHVybiBOfSxnZXRTY3JpcHQ6ZnVuY3Rpb24oZSxuKXtyZXR1cm4gYi5nZXQoZSx0LG4sXCJzY3JpcHRcIil9LGdldEpTT046ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBiLmdldChlLHQsbixcImpzb25cIil9fSk7ZnVuY3Rpb24gX24oZSxuLHIpe3ZhciBpLG8sYSxzLHU9ZS5jb250ZW50cyxsPWUuZGF0YVR5cGVzLGM9ZS5yZXNwb25zZUZpZWxkcztmb3IocyBpbiBjKXMgaW4gciYmKG5bY1tzXV09cltzXSk7d2hpbGUoXCIqXCI9PT1sWzBdKWwuc2hpZnQoKSxvPT09dCYmKG89ZS5taW1lVHlwZXx8bi5nZXRSZXNwb25zZUhlYWRlcihcIkNvbnRlbnQtVHlwZVwiKSk7aWYobylmb3IocyBpbiB1KWlmKHVbc10mJnVbc10udGVzdChvKSl7bC51bnNoaWZ0KHMpO2JyZWFrfWlmKGxbMF1pbiByKWE9bFswXTtlbHNle2ZvcihzIGluIHIpe2lmKCFsWzBdfHxlLmNvbnZlcnRlcnNbcytcIiBcIitsWzBdXSl7YT1zO2JyZWFrfWl8fChpPXMpfWE9YXx8aX1yZXR1cm4gYT8oYSE9PWxbMF0mJmwudW5zaGlmdChhKSxyW2FdKTp0fWZ1bmN0aW9uIEZuKGUsdCl7dmFyIG4scixpLG8sYT17fSxzPTAsdT1lLmRhdGFUeXBlcy5zbGljZSgpLGw9dVswXTtpZihlLmRhdGFGaWx0ZXImJih0PWUuZGF0YUZpbHRlcih0LGUuZGF0YVR5cGUpKSx1WzFdKWZvcihpIGluIGUuY29udmVydGVycylhW2kudG9Mb3dlckNhc2UoKV09ZS5jb252ZXJ0ZXJzW2ldO2Zvcig7cj11Wysrc107KWlmKFwiKlwiIT09cil7aWYoXCIqXCIhPT1sJiZsIT09cil7aWYoaT1hW2wrXCIgXCIrcl18fGFbXCIqIFwiK3JdLCFpKWZvcihuIGluIGEpaWYobz1uLnNwbGl0KFwiIFwiKSxvWzFdPT09ciYmKGk9YVtsK1wiIFwiK29bMF1dfHxhW1wiKiBcIitvWzBdXSkpe2k9PT0hMD9pPWFbbl06YVtuXSE9PSEwJiYocj1vWzBdLHUuc3BsaWNlKHMtLSwwLHIpKTticmVha31pZihpIT09ITApaWYoaSYmZVtcInRocm93c1wiXSl0PWkodCk7ZWxzZSB0cnl7dD1pKHQpfWNhdGNoKGMpe3JldHVybntzdGF0ZTpcInBhcnNlcmVycm9yXCIsZXJyb3I6aT9jOlwiTm8gY29udmVyc2lvbiBmcm9tIFwiK2wrXCIgdG8gXCIrcn19fWw9cn1yZXR1cm57c3RhdGU6XCJzdWNjZXNzXCIsZGF0YTp0fX1iLmFqYXhTZXR1cCh7YWNjZXB0czp7c2NyaXB0OlwidGV4dC9qYXZhc2NyaXB0LCBhcHBsaWNhdGlvbi9qYXZhc2NyaXB0LCBhcHBsaWNhdGlvbi9lY21hc2NyaXB0LCBhcHBsaWNhdGlvbi94LWVjbWFzY3JpcHRcIn0sY29udGVudHM6e3NjcmlwdDovKD86amF2YXxlY21hKXNjcmlwdC99LGNvbnZlcnRlcnM6e1widGV4dCBzY3JpcHRcIjpmdW5jdGlvbihlKXtyZXR1cm4gYi5nbG9iYWxFdmFsKGUpLGV9fX0pLGIuYWpheFByZWZpbHRlcihcInNjcmlwdFwiLGZ1bmN0aW9uKGUpe2UuY2FjaGU9PT10JiYoZS5jYWNoZT0hMSksZS5jcm9zc0RvbWFpbiYmKGUudHlwZT1cIkdFVFwiLGUuZ2xvYmFsPSExKX0pLGIuYWpheFRyYW5zcG9ydChcInNjcmlwdFwiLGZ1bmN0aW9uKGUpe2lmKGUuY3Jvc3NEb21haW4pe3ZhciBuLHI9by5oZWFkfHxiKFwiaGVhZFwiKVswXXx8by5kb2N1bWVudEVsZW1lbnQ7cmV0dXJue3NlbmQ6ZnVuY3Rpb24odCxpKXtuPW8uY3JlYXRlRWxlbWVudChcInNjcmlwdFwiKSxuLmFzeW5jPSEwLGUuc2NyaXB0Q2hhcnNldCYmKG4uY2hhcnNldD1lLnNjcmlwdENoYXJzZXQpLG4uc3JjPWUudXJsLG4ub25sb2FkPW4ub25yZWFkeXN0YXRlY2hhbmdlPWZ1bmN0aW9uKGUsdCl7KHR8fCFuLnJlYWR5U3RhdGV8fC9sb2FkZWR8Y29tcGxldGUvLnRlc3Qobi5yZWFkeVN0YXRlKSkmJihuLm9ubG9hZD1uLm9ucmVhZHlzdGF0ZWNoYW5nZT1udWxsLG4ucGFyZW50Tm9kZSYmbi5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG4pLG49bnVsbCx0fHxpKDIwMCxcInN1Y2Nlc3NcIikpfSxyLmluc2VydEJlZm9yZShuLHIuZmlyc3RDaGlsZCl9LGFib3J0OmZ1bmN0aW9uKCl7biYmbi5vbmxvYWQodCwhMCl9fX19KTt2YXIgT249W10sQm49Lyg9KVxcPyg/PSZ8JCl8XFw/XFw/LztiLmFqYXhTZXR1cCh7anNvbnA6XCJjYWxsYmFja1wiLGpzb25wQ2FsbGJhY2s6ZnVuY3Rpb24oKXt2YXIgZT1Pbi5wb3AoKXx8Yi5leHBhbmRvK1wiX1wiK3ZuKys7cmV0dXJuIHRoaXNbZV09ITAsZX19KSxiLmFqYXhQcmVmaWx0ZXIoXCJqc29uIGpzb25wXCIsZnVuY3Rpb24obixyLGkpe3ZhciBvLGEscyx1PW4uanNvbnAhPT0hMSYmKEJuLnRlc3Qobi51cmwpP1widXJsXCI6XCJzdHJpbmdcIj09dHlwZW9mIG4uZGF0YSYmIShuLmNvbnRlbnRUeXBlfHxcIlwiKS5pbmRleE9mKFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkXCIpJiZCbi50ZXN0KG4uZGF0YSkmJlwiZGF0YVwiKTtyZXR1cm4gdXx8XCJqc29ucFwiPT09bi5kYXRhVHlwZXNbMF0/KG89bi5qc29ucENhbGxiYWNrPWIuaXNGdW5jdGlvbihuLmpzb25wQ2FsbGJhY2spP24uanNvbnBDYWxsYmFjaygpOm4uanNvbnBDYWxsYmFjayx1P25bdV09blt1XS5yZXBsYWNlKEJuLFwiJDFcIitvKTpuLmpzb25wIT09ITEmJihuLnVybCs9KGJuLnRlc3Qobi51cmwpP1wiJlwiOlwiP1wiKStuLmpzb25wK1wiPVwiK28pLG4uY29udmVydGVyc1tcInNjcmlwdCBqc29uXCJdPWZ1bmN0aW9uKCl7cmV0dXJuIHN8fGIuZXJyb3IobytcIiB3YXMgbm90IGNhbGxlZFwiKSxzWzBdfSxuLmRhdGFUeXBlc1swXT1cImpzb25cIixhPWVbb10sZVtvXT1mdW5jdGlvbigpe3M9YXJndW1lbnRzfSxpLmFsd2F5cyhmdW5jdGlvbigpe2Vbb109YSxuW29dJiYobi5qc29ucENhbGxiYWNrPXIuanNvbnBDYWxsYmFjayxPbi5wdXNoKG8pKSxzJiZiLmlzRnVuY3Rpb24oYSkmJmEoc1swXSkscz1hPXR9KSxcInNjcmlwdFwiKTp0fSk7dmFyIFBuLFJuLFduPTAsJG49ZS5BY3RpdmVYT2JqZWN0JiZmdW5jdGlvbigpe3ZhciBlO2ZvcihlIGluIFBuKVBuW2VdKHQsITApfTtmdW5jdGlvbiBJbigpe3RyeXtyZXR1cm4gbmV3IGUuWE1MSHR0cFJlcXVlc3R9Y2F0Y2godCl7fX1mdW5jdGlvbiB6bigpe3RyeXtyZXR1cm4gbmV3IGUuQWN0aXZlWE9iamVjdChcIk1pY3Jvc29mdC5YTUxIVFRQXCIpfWNhdGNoKHQpe319Yi5hamF4U2V0dGluZ3MueGhyPWUuQWN0aXZlWE9iamVjdD9mdW5jdGlvbigpe3JldHVybiF0aGlzLmlzTG9jYWwmJkluKCl8fHpuKCl9OkluLFJuPWIuYWpheFNldHRpbmdzLnhocigpLGIuc3VwcG9ydC5jb3JzPSEhUm4mJlwid2l0aENyZWRlbnRpYWxzXCJpbiBSbixSbj1iLnN1cHBvcnQuYWpheD0hIVJuLFJuJiZiLmFqYXhUcmFuc3BvcnQoZnVuY3Rpb24obil7aWYoIW4uY3Jvc3NEb21haW58fGIuc3VwcG9ydC5jb3JzKXt2YXIgcjtyZXR1cm57c2VuZDpmdW5jdGlvbihpLG8pe3ZhciBhLHMsdT1uLnhocigpO2lmKG4udXNlcm5hbWU/dS5vcGVuKG4udHlwZSxuLnVybCxuLmFzeW5jLG4udXNlcm5hbWUsbi5wYXNzd29yZCk6dS5vcGVuKG4udHlwZSxuLnVybCxuLmFzeW5jKSxuLnhockZpZWxkcylmb3IocyBpbiBuLnhockZpZWxkcyl1W3NdPW4ueGhyRmllbGRzW3NdO24ubWltZVR5cGUmJnUub3ZlcnJpZGVNaW1lVHlwZSYmdS5vdmVycmlkZU1pbWVUeXBlKG4ubWltZVR5cGUpLG4uY3Jvc3NEb21haW58fGlbXCJYLVJlcXVlc3RlZC1XaXRoXCJdfHwoaVtcIlgtUmVxdWVzdGVkLVdpdGhcIl09XCJYTUxIdHRwUmVxdWVzdFwiKTt0cnl7Zm9yKHMgaW4gaSl1LnNldFJlcXVlc3RIZWFkZXIocyxpW3NdKX1jYXRjaChsKXt9dS5zZW5kKG4uaGFzQ29udGVudCYmbi5kYXRhfHxudWxsKSxyPWZ1bmN0aW9uKGUsaSl7dmFyIHMsbCxjLHA7dHJ5e2lmKHImJihpfHw0PT09dS5yZWFkeVN0YXRlKSlpZihyPXQsYSYmKHUub25yZWFkeXN0YXRlY2hhbmdlPWIubm9vcCwkbiYmZGVsZXRlIFBuW2FdKSxpKTQhPT11LnJlYWR5U3RhdGUmJnUuYWJvcnQoKTtlbHNle3A9e30scz11LnN0YXR1cyxsPXUuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzKCksXCJzdHJpbmdcIj09dHlwZW9mIHUucmVzcG9uc2VUZXh0JiYocC50ZXh0PXUucmVzcG9uc2VUZXh0KTt0cnl7Yz11LnN0YXR1c1RleHR9Y2F0Y2goZil7Yz1cIlwifXN8fCFuLmlzTG9jYWx8fG4uY3Jvc3NEb21haW4/MTIyMz09PXMmJihzPTIwNCk6cz1wLnRleHQ/MjAwOjQwNH19Y2F0Y2goZCl7aXx8bygtMSxkKX1wJiZvKHMsYyxwLGwpfSxuLmFzeW5jPzQ9PT11LnJlYWR5U3RhdGU/c2V0VGltZW91dChyKTooYT0rK1duLCRuJiYoUG58fChQbj17fSxiKGUpLnVubG9hZCgkbikpLFBuW2FdPXIpLHUub25yZWFkeXN0YXRlY2hhbmdlPXIpOnIoKX0sYWJvcnQ6ZnVuY3Rpb24oKXtyJiZyKHQsITApfX19fSk7dmFyIFhuLFVuLFZuPS9eKD86dG9nZ2xlfHNob3d8aGlkZSkkLyxZbj1SZWdFeHAoXCJeKD86KFsrLV0pPXwpKFwiK3grXCIpKFthLXolXSopJFwiLFwiaVwiKSxKbj0vcXVldWVIb29rcyQvLEduPVtucl0sUW49e1wiKlwiOltmdW5jdGlvbihlLHQpe3ZhciBuLHIsaT10aGlzLmNyZWF0ZVR3ZWVuKGUsdCksbz1Zbi5leGVjKHQpLGE9aS5jdXIoKSxzPSthfHwwLHU9MSxsPTIwO2lmKG8pe2lmKG49K29bMl0scj1vWzNdfHwoYi5jc3NOdW1iZXJbZV0/XCJcIjpcInB4XCIpLFwicHhcIiE9PXImJnMpe3M9Yi5jc3MoaS5lbGVtLGUsITApfHxufHwxO2RvIHU9dXx8XCIuNVwiLHMvPXUsYi5zdHlsZShpLmVsZW0sZSxzK3IpO3doaWxlKHUhPT0odT1pLmN1cigpL2EpJiYxIT09dSYmLS1sKX1pLnVuaXQ9cixpLnN0YXJ0PXMsaS5lbmQ9b1sxXT9zKyhvWzFdKzEpKm46bn1yZXR1cm4gaX1dfTtmdW5jdGlvbiBLbigpe3JldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7WG49dH0pLFhuPWIubm93KCl9ZnVuY3Rpb24gWm4oZSx0KXtiLmVhY2godCxmdW5jdGlvbih0LG4pe3ZhciByPShRblt0XXx8W10pLmNvbmNhdChRbltcIipcIl0pLGk9MCxvPXIubGVuZ3RoO2Zvcig7bz5pO2krKylpZihyW2ldLmNhbGwoZSx0LG4pKXJldHVybn0pfWZ1bmN0aW9uIGVyKGUsdCxuKXt2YXIgcixpLG89MCxhPUduLmxlbmd0aCxzPWIuRGVmZXJyZWQoKS5hbHdheXMoZnVuY3Rpb24oKXtkZWxldGUgdS5lbGVtfSksdT1mdW5jdGlvbigpe2lmKGkpcmV0dXJuITE7dmFyIHQ9WG58fEtuKCksbj1NYXRoLm1heCgwLGwuc3RhcnRUaW1lK2wuZHVyYXRpb24tdCkscj1uL2wuZHVyYXRpb258fDAsbz0xLXIsYT0wLHU9bC50d2VlbnMubGVuZ3RoO2Zvcig7dT5hO2ErKylsLnR3ZWVuc1thXS5ydW4obyk7cmV0dXJuIHMubm90aWZ5V2l0aChlLFtsLG8sbl0pLDE+byYmdT9uOihzLnJlc29sdmVXaXRoKGUsW2xdKSwhMSl9LGw9cy5wcm9taXNlKHtlbGVtOmUscHJvcHM6Yi5leHRlbmQoe30sdCksb3B0czpiLmV4dGVuZCghMCx7c3BlY2lhbEVhc2luZzp7fX0sbiksb3JpZ2luYWxQcm9wZXJ0aWVzOnQsb3JpZ2luYWxPcHRpb25zOm4sc3RhcnRUaW1lOlhufHxLbigpLGR1cmF0aW9uOm4uZHVyYXRpb24sdHdlZW5zOltdLGNyZWF0ZVR3ZWVuOmZ1bmN0aW9uKHQsbil7dmFyIHI9Yi5Ud2VlbihlLGwub3B0cyx0LG4sbC5vcHRzLnNwZWNpYWxFYXNpbmdbdF18fGwub3B0cy5lYXNpbmcpO3JldHVybiBsLnR3ZWVucy5wdXNoKHIpLHJ9LHN0b3A6ZnVuY3Rpb24odCl7dmFyIG49MCxyPXQ/bC50d2VlbnMubGVuZ3RoOjA7aWYoaSlyZXR1cm4gdGhpcztmb3IoaT0hMDtyPm47bisrKWwudHdlZW5zW25dLnJ1bigxKTtyZXR1cm4gdD9zLnJlc29sdmVXaXRoKGUsW2wsdF0pOnMucmVqZWN0V2l0aChlLFtsLHRdKSx0aGlzfX0pLGM9bC5wcm9wcztmb3IodHIoYyxsLm9wdHMuc3BlY2lhbEVhc2luZyk7YT5vO28rKylpZihyPUduW29dLmNhbGwobCxlLGMsbC5vcHRzKSlyZXR1cm4gcjtyZXR1cm4gWm4obCxjKSxiLmlzRnVuY3Rpb24obC5vcHRzLnN0YXJ0KSYmbC5vcHRzLnN0YXJ0LmNhbGwoZSxsKSxiLmZ4LnRpbWVyKGIuZXh0ZW5kKHUse2VsZW06ZSxhbmltOmwscXVldWU6bC5vcHRzLnF1ZXVlfSkpLGwucHJvZ3Jlc3MobC5vcHRzLnByb2dyZXNzKS5kb25lKGwub3B0cy5kb25lLGwub3B0cy5jb21wbGV0ZSkuZmFpbChsLm9wdHMuZmFpbCkuYWx3YXlzKGwub3B0cy5hbHdheXMpfWZ1bmN0aW9uIHRyKGUsdCl7dmFyIG4scixpLG8sYTtmb3IoaSBpbiBlKWlmKHI9Yi5jYW1lbENhc2UoaSksbz10W3JdLG49ZVtpXSxiLmlzQXJyYXkobikmJihvPW5bMV0sbj1lW2ldPW5bMF0pLGkhPT1yJiYoZVtyXT1uLGRlbGV0ZSBlW2ldKSxhPWIuY3NzSG9va3Nbcl0sYSYmXCJleHBhbmRcImluIGEpe249YS5leHBhbmQobiksZGVsZXRlIGVbcl07Zm9yKGkgaW4gbilpIGluIGV8fChlW2ldPW5baV0sdFtpXT1vKX1lbHNlIHRbcl09b31iLkFuaW1hdGlvbj1iLmV4dGVuZChlcix7dHdlZW5lcjpmdW5jdGlvbihlLHQpe2IuaXNGdW5jdGlvbihlKT8odD1lLGU9W1wiKlwiXSk6ZT1lLnNwbGl0KFwiIFwiKTt2YXIgbixyPTAsaT1lLmxlbmd0aDtmb3IoO2k+cjtyKyspbj1lW3JdLFFuW25dPVFuW25dfHxbXSxRbltuXS51bnNoaWZ0KHQpfSxwcmVmaWx0ZXI6ZnVuY3Rpb24oZSx0KXt0P0duLnVuc2hpZnQoZSk6R24ucHVzaChlKX19KTtmdW5jdGlvbiBucihlLHQsbil7dmFyIHIsaSxvLGEscyx1LGwsYyxwLGY9dGhpcyxkPWUuc3R5bGUsaD17fSxnPVtdLG09ZS5ub2RlVHlwZSYmbm4oZSk7bi5xdWV1ZXx8KGM9Yi5fcXVldWVIb29rcyhlLFwiZnhcIiksbnVsbD09Yy51bnF1ZXVlZCYmKGMudW5xdWV1ZWQ9MCxwPWMuZW1wdHkuZmlyZSxjLmVtcHR5LmZpcmU9ZnVuY3Rpb24oKXtjLnVucXVldWVkfHxwKCl9KSxjLnVucXVldWVkKyssZi5hbHdheXMoZnVuY3Rpb24oKXtmLmFsd2F5cyhmdW5jdGlvbigpe2MudW5xdWV1ZWQtLSxiLnF1ZXVlKGUsXCJmeFwiKS5sZW5ndGh8fGMuZW1wdHkuZmlyZSgpfSl9KSksMT09PWUubm9kZVR5cGUmJihcImhlaWdodFwiaW4gdHx8XCJ3aWR0aFwiaW4gdCkmJihuLm92ZXJmbG93PVtkLm92ZXJmbG93LGQub3ZlcmZsb3dYLGQub3ZlcmZsb3dZXSxcImlubGluZVwiPT09Yi5jc3MoZSxcImRpc3BsYXlcIikmJlwibm9uZVwiPT09Yi5jc3MoZSxcImZsb2F0XCIpJiYoYi5zdXBwb3J0LmlubGluZUJsb2NrTmVlZHNMYXlvdXQmJlwiaW5saW5lXCIhPT11bihlLm5vZGVOYW1lKT9kLnpvb209MTpkLmRpc3BsYXk9XCJpbmxpbmUtYmxvY2tcIikpLG4ub3ZlcmZsb3cmJihkLm92ZXJmbG93PVwiaGlkZGVuXCIsYi5zdXBwb3J0LnNocmlua1dyYXBCbG9ja3N8fGYuYWx3YXlzKGZ1bmN0aW9uKCl7ZC5vdmVyZmxvdz1uLm92ZXJmbG93WzBdLGQub3ZlcmZsb3dYPW4ub3ZlcmZsb3dbMV0sZC5vdmVyZmxvd1k9bi5vdmVyZmxvd1syXX0pKTtmb3IoaSBpbiB0KWlmKGE9dFtpXSxWbi5leGVjKGEpKXtpZihkZWxldGUgdFtpXSx1PXV8fFwidG9nZ2xlXCI9PT1hLGE9PT0obT9cImhpZGVcIjpcInNob3dcIikpY29udGludWU7Zy5wdXNoKGkpfWlmKG89Zy5sZW5ndGgpe3M9Yi5fZGF0YShlLFwiZnhzaG93XCIpfHxiLl9kYXRhKGUsXCJmeHNob3dcIix7fSksXCJoaWRkZW5cImluIHMmJihtPXMuaGlkZGVuKSx1JiYocy5oaWRkZW49IW0pLG0/YihlKS5zaG93KCk6Zi5kb25lKGZ1bmN0aW9uKCl7YihlKS5oaWRlKCl9KSxmLmRvbmUoZnVuY3Rpb24oKXt2YXIgdDtiLl9yZW1vdmVEYXRhKGUsXCJmeHNob3dcIik7Zm9yKHQgaW4gaCliLnN0eWxlKGUsdCxoW3RdKX0pO2ZvcihpPTA7bz5pO2krKylyPWdbaV0sbD1mLmNyZWF0ZVR3ZWVuKHIsbT9zW3JdOjApLGhbcl09c1tyXXx8Yi5zdHlsZShlLHIpLHIgaW4gc3x8KHNbcl09bC5zdGFydCxtJiYobC5lbmQ9bC5zdGFydCxsLnN0YXJ0PVwid2lkdGhcIj09PXJ8fFwiaGVpZ2h0XCI9PT1yPzE6MCkpfX1mdW5jdGlvbiBycihlLHQsbixyLGkpe3JldHVybiBuZXcgcnIucHJvdG90eXBlLmluaXQoZSx0LG4scixpKX1iLlR3ZWVuPXJyLHJyLnByb3RvdHlwZT17Y29uc3RydWN0b3I6cnIsaW5pdDpmdW5jdGlvbihlLHQsbixyLGksbyl7dGhpcy5lbGVtPWUsdGhpcy5wcm9wPW4sdGhpcy5lYXNpbmc9aXx8XCJzd2luZ1wiLHRoaXMub3B0aW9ucz10LHRoaXMuc3RhcnQ9dGhpcy5ub3c9dGhpcy5jdXIoKSx0aGlzLmVuZD1yLHRoaXMudW5pdD1vfHwoYi5jc3NOdW1iZXJbbl0/XCJcIjpcInB4XCIpfSxjdXI6ZnVuY3Rpb24oKXt2YXIgZT1yci5wcm9wSG9va3NbdGhpcy5wcm9wXTtyZXR1cm4gZSYmZS5nZXQ/ZS5nZXQodGhpcyk6cnIucHJvcEhvb2tzLl9kZWZhdWx0LmdldCh0aGlzKX0scnVuOmZ1bmN0aW9uKGUpe3ZhciB0LG49cnIucHJvcEhvb2tzW3RoaXMucHJvcF07cmV0dXJuIHRoaXMucG9zPXQ9dGhpcy5vcHRpb25zLmR1cmF0aW9uP2IuZWFzaW5nW3RoaXMuZWFzaW5nXShlLHRoaXMub3B0aW9ucy5kdXJhdGlvbiplLDAsMSx0aGlzLm9wdGlvbnMuZHVyYXRpb24pOmUsdGhpcy5ub3c9KHRoaXMuZW5kLXRoaXMuc3RhcnQpKnQrdGhpcy5zdGFydCx0aGlzLm9wdGlvbnMuc3RlcCYmdGhpcy5vcHRpb25zLnN0ZXAuY2FsbCh0aGlzLmVsZW0sdGhpcy5ub3csdGhpcyksbiYmbi5zZXQ/bi5zZXQodGhpcyk6cnIucHJvcEhvb2tzLl9kZWZhdWx0LnNldCh0aGlzKSx0aGlzfX0scnIucHJvdG90eXBlLmluaXQucHJvdG90eXBlPXJyLnByb3RvdHlwZSxyci5wcm9wSG9va3M9e19kZWZhdWx0OntnZXQ6ZnVuY3Rpb24oZSl7dmFyIHQ7cmV0dXJuIG51bGw9PWUuZWxlbVtlLnByb3BdfHxlLmVsZW0uc3R5bGUmJm51bGwhPWUuZWxlbS5zdHlsZVtlLnByb3BdPyh0PWIuY3NzKGUuZWxlbSxlLnByb3AsXCJcIiksdCYmXCJhdXRvXCIhPT10P3Q6MCk6ZS5lbGVtW2UucHJvcF19LHNldDpmdW5jdGlvbihlKXtiLmZ4LnN0ZXBbZS5wcm9wXT9iLmZ4LnN0ZXBbZS5wcm9wXShlKTplLmVsZW0uc3R5bGUmJihudWxsIT1lLmVsZW0uc3R5bGVbYi5jc3NQcm9wc1tlLnByb3BdXXx8Yi5jc3NIb29rc1tlLnByb3BdKT9iLnN0eWxlKGUuZWxlbSxlLnByb3AsZS5ub3crZS51bml0KTplLmVsZW1bZS5wcm9wXT1lLm5vd319fSxyci5wcm9wSG9va3Muc2Nyb2xsVG9wPXJyLnByb3BIb29rcy5zY3JvbGxMZWZ0PXtzZXQ6ZnVuY3Rpb24oZSl7ZS5lbGVtLm5vZGVUeXBlJiZlLmVsZW0ucGFyZW50Tm9kZSYmKGUuZWxlbVtlLnByb3BdPWUubm93KX19LGIuZWFjaChbXCJ0b2dnbGVcIixcInNob3dcIixcImhpZGVcIl0sZnVuY3Rpb24oZSx0KXt2YXIgbj1iLmZuW3RdO2IuZm5bdF09ZnVuY3Rpb24oZSxyLGkpe3JldHVybiBudWxsPT1lfHxcImJvb2xlYW5cIj09dHlwZW9mIGU/bi5hcHBseSh0aGlzLGFyZ3VtZW50cyk6dGhpcy5hbmltYXRlKGlyKHQsITApLGUscixpKX19KSxiLmZuLmV4dGVuZCh7ZmFkZVRvOmZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiB0aGlzLmZpbHRlcihubikuY3NzKFwib3BhY2l0eVwiLDApLnNob3coKS5lbmQoKS5hbmltYXRlKHtvcGFjaXR5OnR9LGUsbixyKX0sYW5pbWF0ZTpmdW5jdGlvbihlLHQsbixyKXt2YXIgaT1iLmlzRW1wdHlPYmplY3QoZSksbz1iLnNwZWVkKHQsbixyKSxhPWZ1bmN0aW9uKCl7dmFyIHQ9ZXIodGhpcyxiLmV4dGVuZCh7fSxlKSxvKTthLmZpbmlzaD1mdW5jdGlvbigpe3Quc3RvcCghMCl9LChpfHxiLl9kYXRhKHRoaXMsXCJmaW5pc2hcIikpJiZ0LnN0b3AoITApfTtyZXR1cm4gYS5maW5pc2g9YSxpfHxvLnF1ZXVlPT09ITE/dGhpcy5lYWNoKGEpOnRoaXMucXVldWUoby5xdWV1ZSxhKX0sc3RvcDpmdW5jdGlvbihlLG4scil7dmFyIGk9ZnVuY3Rpb24oZSl7dmFyIHQ9ZS5zdG9wO2RlbGV0ZSBlLnN0b3AsdChyKX07cmV0dXJuXCJzdHJpbmdcIiE9dHlwZW9mIGUmJihyPW4sbj1lLGU9dCksbiYmZSE9PSExJiZ0aGlzLnF1ZXVlKGV8fFwiZnhcIixbXSksdGhpcy5lYWNoKGZ1bmN0aW9uKCl7dmFyIHQ9ITAsbj1udWxsIT1lJiZlK1wicXVldWVIb29rc1wiLG89Yi50aW1lcnMsYT1iLl9kYXRhKHRoaXMpO2lmKG4pYVtuXSYmYVtuXS5zdG9wJiZpKGFbbl0pO2Vsc2UgZm9yKG4gaW4gYSlhW25dJiZhW25dLnN0b3AmJkpuLnRlc3QobikmJmkoYVtuXSk7Zm9yKG49by5sZW5ndGg7bi0tOylvW25dLmVsZW0hPT10aGlzfHxudWxsIT1lJiZvW25dLnF1ZXVlIT09ZXx8KG9bbl0uYW5pbS5zdG9wKHIpLHQ9ITEsby5zcGxpY2UobiwxKSk7KHR8fCFyKSYmYi5kZXF1ZXVlKHRoaXMsZSl9KX0sZmluaXNoOmZ1bmN0aW9uKGUpe3JldHVybiBlIT09ITEmJihlPWV8fFwiZnhcIiksdGhpcy5lYWNoKGZ1bmN0aW9uKCl7dmFyIHQsbj1iLl9kYXRhKHRoaXMpLHI9bltlK1wicXVldWVcIl0saT1uW2UrXCJxdWV1ZUhvb2tzXCJdLG89Yi50aW1lcnMsYT1yP3IubGVuZ3RoOjA7Zm9yKG4uZmluaXNoPSEwLGIucXVldWUodGhpcyxlLFtdKSxpJiZpLmN1ciYmaS5jdXIuZmluaXNoJiZpLmN1ci5maW5pc2guY2FsbCh0aGlzKSx0PW8ubGVuZ3RoO3QtLTspb1t0XS5lbGVtPT09dGhpcyYmb1t0XS5xdWV1ZT09PWUmJihvW3RdLmFuaW0uc3RvcCghMCksby5zcGxpY2UodCwxKSk7Zm9yKHQ9MDthPnQ7dCsrKXJbdF0mJnJbdF0uZmluaXNoJiZyW3RdLmZpbmlzaC5jYWxsKHRoaXMpO2RlbGV0ZSBuLmZpbmlzaH0pfX0pO2Z1bmN0aW9uIGlyKGUsdCl7dmFyIG4scj17aGVpZ2h0OmV9LGk9MDtmb3IodD10PzE6MDs0Pmk7aSs9Mi10KW49WnRbaV0scltcIm1hcmdpblwiK25dPXJbXCJwYWRkaW5nXCIrbl09ZTtyZXR1cm4gdCYmKHIub3BhY2l0eT1yLndpZHRoPWUpLHJ9Yi5lYWNoKHtzbGlkZURvd246aXIoXCJzaG93XCIpLHNsaWRlVXA6aXIoXCJoaWRlXCIpLHNsaWRlVG9nZ2xlOmlyKFwidG9nZ2xlXCIpLGZhZGVJbjp7b3BhY2l0eTpcInNob3dcIn0sZmFkZU91dDp7b3BhY2l0eTpcImhpZGVcIn0sZmFkZVRvZ2dsZTp7b3BhY2l0eTpcInRvZ2dsZVwifX0sZnVuY3Rpb24oZSx0KXtiLmZuW2VdPWZ1bmN0aW9uKGUsbixyKXtyZXR1cm4gdGhpcy5hbmltYXRlKHQsZSxuLHIpfX0pLGIuc3BlZWQ9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPWUmJlwib2JqZWN0XCI9PXR5cGVvZiBlP2IuZXh0ZW5kKHt9LGUpOntjb21wbGV0ZTpufHwhbiYmdHx8Yi5pc0Z1bmN0aW9uKGUpJiZlLGR1cmF0aW9uOmUsZWFzaW5nOm4mJnR8fHQmJiFiLmlzRnVuY3Rpb24odCkmJnR9O3JldHVybiByLmR1cmF0aW9uPWIuZngub2ZmPzA6XCJudW1iZXJcIj09dHlwZW9mIHIuZHVyYXRpb24/ci5kdXJhdGlvbjpyLmR1cmF0aW9uIGluIGIuZnguc3BlZWRzP2IuZnguc3BlZWRzW3IuZHVyYXRpb25dOmIuZnguc3BlZWRzLl9kZWZhdWx0LChudWxsPT1yLnF1ZXVlfHxyLnF1ZXVlPT09ITApJiYoci5xdWV1ZT1cImZ4XCIpLHIub2xkPXIuY29tcGxldGUsci5jb21wbGV0ZT1mdW5jdGlvbigpe2IuaXNGdW5jdGlvbihyLm9sZCkmJnIub2xkLmNhbGwodGhpcyksci5xdWV1ZSYmYi5kZXF1ZXVlKHRoaXMsci5xdWV1ZSl9LHJ9LGIuZWFzaW5nPXtsaW5lYXI6ZnVuY3Rpb24oZSl7cmV0dXJuIGV9LHN3aW5nOmZ1bmN0aW9uKGUpe3JldHVybi41LU1hdGguY29zKGUqTWF0aC5QSSkvMn19LGIudGltZXJzPVtdLGIuZng9cnIucHJvdG90eXBlLmluaXQsYi5meC50aWNrPWZ1bmN0aW9uKCl7dmFyIGUsbj1iLnRpbWVycyxyPTA7Zm9yKFhuPWIubm93KCk7bi5sZW5ndGg+cjtyKyspZT1uW3JdLGUoKXx8bltyXSE9PWV8fG4uc3BsaWNlKHItLSwxKTtuLmxlbmd0aHx8Yi5meC5zdG9wKCksWG49dH0sYi5meC50aW1lcj1mdW5jdGlvbihlKXtlKCkmJmIudGltZXJzLnB1c2goZSkmJmIuZnguc3RhcnQoKX0sYi5meC5pbnRlcnZhbD0xMyxiLmZ4LnN0YXJ0PWZ1bmN0aW9uKCl7VW58fChVbj1zZXRJbnRlcnZhbChiLmZ4LnRpY2ssYi5meC5pbnRlcnZhbCkpfSxiLmZ4LnN0b3A9ZnVuY3Rpb24oKXtjbGVhckludGVydmFsKFVuKSxVbj1udWxsfSxiLmZ4LnNwZWVkcz17c2xvdzo2MDAsZmFzdDoyMDAsX2RlZmF1bHQ6NDAwfSxiLmZ4LnN0ZXA9e30sYi5leHByJiZiLmV4cHIuZmlsdGVycyYmKGIuZXhwci5maWx0ZXJzLmFuaW1hdGVkPWZ1bmN0aW9uKGUpe3JldHVybiBiLmdyZXAoYi50aW1lcnMsZnVuY3Rpb24odCl7cmV0dXJuIGU9PT10LmVsZW19KS5sZW5ndGh9KSxiLmZuLm9mZnNldD1mdW5jdGlvbihlKXtpZihhcmd1bWVudHMubGVuZ3RoKXJldHVybiBlPT09dD90aGlzOnRoaXMuZWFjaChmdW5jdGlvbih0KXtiLm9mZnNldC5zZXRPZmZzZXQodGhpcyxlLHQpfSk7dmFyIG4scixvPXt0b3A6MCxsZWZ0OjB9LGE9dGhpc1swXSxzPWEmJmEub3duZXJEb2N1bWVudDtpZihzKXJldHVybiBuPXMuZG9jdW1lbnRFbGVtZW50LGIuY29udGFpbnMobixhKT8odHlwZW9mIGEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0IT09aSYmKG89YS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSkscj1vcihzKSx7dG9wOm8udG9wKyhyLnBhZ2VZT2Zmc2V0fHxuLnNjcm9sbFRvcCktKG4uY2xpZW50VG9wfHwwKSxsZWZ0Om8ubGVmdCsoci5wYWdlWE9mZnNldHx8bi5zY3JvbGxMZWZ0KS0obi5jbGllbnRMZWZ0fHwwKX0pOm99LGIub2Zmc2V0PXtzZXRPZmZzZXQ6ZnVuY3Rpb24oZSx0LG4pe3ZhciByPWIuY3NzKGUsXCJwb3NpdGlvblwiKTtcInN0YXRpY1wiPT09ciYmKGUuc3R5bGUucG9zaXRpb249XCJyZWxhdGl2ZVwiKTt2YXIgaT1iKGUpLG89aS5vZmZzZXQoKSxhPWIuY3NzKGUsXCJ0b3BcIikscz1iLmNzcyhlLFwibGVmdFwiKSx1PShcImFic29sdXRlXCI9PT1yfHxcImZpeGVkXCI9PT1yKSYmYi5pbkFycmF5KFwiYXV0b1wiLFthLHNdKT4tMSxsPXt9LGM9e30scCxmO3U/KGM9aS5wb3NpdGlvbigpLHA9Yy50b3AsZj1jLmxlZnQpOihwPXBhcnNlRmxvYXQoYSl8fDAsZj1wYXJzZUZsb2F0KHMpfHwwKSxiLmlzRnVuY3Rpb24odCkmJih0PXQuY2FsbChlLG4sbykpLG51bGwhPXQudG9wJiYobC50b3A9dC50b3Atby50b3ArcCksbnVsbCE9dC5sZWZ0JiYobC5sZWZ0PXQubGVmdC1vLmxlZnQrZiksXCJ1c2luZ1wiaW4gdD90LnVzaW5nLmNhbGwoZSxsKTppLmNzcyhsKX19LGIuZm4uZXh0ZW5kKHtwb3NpdGlvbjpmdW5jdGlvbigpe2lmKHRoaXNbMF0pe3ZhciBlLHQsbj17dG9wOjAsbGVmdDowfSxyPXRoaXNbMF07cmV0dXJuXCJmaXhlZFwiPT09Yi5jc3MocixcInBvc2l0aW9uXCIpP3Q9ci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTooZT10aGlzLm9mZnNldFBhcmVudCgpLHQ9dGhpcy5vZmZzZXQoKSxiLm5vZGVOYW1lKGVbMF0sXCJodG1sXCIpfHwobj1lLm9mZnNldCgpKSxuLnRvcCs9Yi5jc3MoZVswXSxcImJvcmRlclRvcFdpZHRoXCIsITApLG4ubGVmdCs9Yi5jc3MoZVswXSxcImJvcmRlckxlZnRXaWR0aFwiLCEwKSkse3RvcDp0LnRvcC1uLnRvcC1iLmNzcyhyLFwibWFyZ2luVG9wXCIsITApLGxlZnQ6dC5sZWZ0LW4ubGVmdC1iLmNzcyhyLFwibWFyZ2luTGVmdFwiLCEwKX19fSxvZmZzZXRQYXJlbnQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5tYXAoZnVuY3Rpb24oKXt2YXIgZT10aGlzLm9mZnNldFBhcmVudHx8by5kb2N1bWVudEVsZW1lbnQ7d2hpbGUoZSYmIWIubm9kZU5hbWUoZSxcImh0bWxcIikmJlwic3RhdGljXCI9PT1iLmNzcyhlLFwicG9zaXRpb25cIikpZT1lLm9mZnNldFBhcmVudDtyZXR1cm4gZXx8by5kb2N1bWVudEVsZW1lbnR9KX19KSxiLmVhY2goe3Njcm9sbExlZnQ6XCJwYWdlWE9mZnNldFwiLHNjcm9sbFRvcDpcInBhZ2VZT2Zmc2V0XCJ9LGZ1bmN0aW9uKGUsbil7dmFyIHI9L1kvLnRlc3Qobik7Yi5mbltlXT1mdW5jdGlvbihpKXtyZXR1cm4gYi5hY2Nlc3ModGhpcyxmdW5jdGlvbihlLGksbyl7dmFyIGE9b3IoZSk7cmV0dXJuIG89PT10P2E/biBpbiBhP2Fbbl06YS5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnRbaV06ZVtpXTooYT9hLnNjcm9sbFRvKHI/YihhKS5zY3JvbGxMZWZ0KCk6byxyP286YihhKS5zY3JvbGxUb3AoKSk6ZVtpXT1vLHQpfSxlLGksYXJndW1lbnRzLmxlbmd0aCxudWxsKX19KTtmdW5jdGlvbiBvcihlKXtyZXR1cm4gYi5pc1dpbmRvdyhlKT9lOjk9PT1lLm5vZGVUeXBlP2UuZGVmYXVsdFZpZXd8fGUucGFyZW50V2luZG93OiExfWIuZWFjaCh7SGVpZ2h0OlwiaGVpZ2h0XCIsV2lkdGg6XCJ3aWR0aFwifSxmdW5jdGlvbihlLG4pe2IuZWFjaCh7cGFkZGluZzpcImlubmVyXCIrZSxjb250ZW50Om4sXCJcIjpcIm91dGVyXCIrZX0sZnVuY3Rpb24ocixpKXtiLmZuW2ldPWZ1bmN0aW9uKGksbyl7dmFyIGE9YXJndW1lbnRzLmxlbmd0aCYmKHJ8fFwiYm9vbGVhblwiIT10eXBlb2YgaSkscz1yfHwoaT09PSEwfHxvPT09ITA/XCJtYXJnaW5cIjpcImJvcmRlclwiKTtyZXR1cm4gYi5hY2Nlc3ModGhpcyxmdW5jdGlvbihuLHIsaSl7dmFyIG87cmV0dXJuIGIuaXNXaW5kb3cobik/bi5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnRbXCJjbGllbnRcIitlXTo5PT09bi5ub2RlVHlwZT8obz1uLmRvY3VtZW50RWxlbWVudCxNYXRoLm1heChuLmJvZHlbXCJzY3JvbGxcIitlXSxvW1wic2Nyb2xsXCIrZV0sbi5ib2R5W1wib2Zmc2V0XCIrZV0sb1tcIm9mZnNldFwiK2VdLG9bXCJjbGllbnRcIitlXSkpOmk9PT10P2IuY3NzKG4scixzKTpiLnN0eWxlKG4scixpLHMpfSxuLGE/aTp0LGEsbnVsbCl9fSl9KSxlLmpRdWVyeT1lLiQ9YixcImZ1bmN0aW9uXCI9PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQmJmRlZmluZS5hbWQualF1ZXJ5JiZkZWZpbmUoXCJqcXVlcnlcIixbXSxmdW5jdGlvbigpe3JldHVybiBifSl9KSh3aW5kb3cpOyIsIi8qZ2xvYmFsIGRlZmluZTpmYWxzZSAqL1xuLyoqXG4gKiBDb3B5cmlnaHQgMjAxMyBDcmFpZyBDYW1wYmVsbFxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICpcbiAqIE1vdXNldHJhcCBpcyBhIHNpbXBsZSBrZXlib2FyZCBzaG9ydGN1dCBsaWJyYXJ5IGZvciBKYXZhc2NyaXB0IHdpdGhcbiAqIG5vIGV4dGVybmFsIGRlcGVuZGVuY2llc1xuICpcbiAqIEB2ZXJzaW9uIDEuNC42XG4gKiBAdXJsIGNyYWlnLmlzL2tpbGxpbmcvbWljZVxuICovXG4oZnVuY3Rpb24od2luZG93LCBkb2N1bWVudCwgdW5kZWZpbmVkKSB7XG5cbiAgICAvKipcbiAgICAgKiBtYXBwaW5nIG9mIHNwZWNpYWwga2V5Y29kZXMgdG8gdGhlaXIgY29ycmVzcG9uZGluZyBrZXlzXG4gICAgICpcbiAgICAgKiBldmVyeXRoaW5nIGluIHRoaXMgZGljdGlvbmFyeSBjYW5ub3QgdXNlIGtleXByZXNzIGV2ZW50c1xuICAgICAqIHNvIGl0IGhhcyB0byBiZSBoZXJlIHRvIG1hcCB0byB0aGUgY29ycmVjdCBrZXljb2RlcyBmb3JcbiAgICAgKiBrZXl1cC9rZXlkb3duIGV2ZW50c1xuICAgICAqXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICB2YXIgX01BUCA9IHtcbiAgICAgICAgICAgIDg6ICdiYWNrc3BhY2UnLFxuICAgICAgICAgICAgOTogJ3RhYicsXG4gICAgICAgICAgICAxMzogJ2VudGVyJyxcbiAgICAgICAgICAgIDE2OiAnc2hpZnQnLFxuICAgICAgICAgICAgMTc6ICdjdHJsJyxcbiAgICAgICAgICAgIDE4OiAnYWx0JyxcbiAgICAgICAgICAgIDIwOiAnY2Fwc2xvY2snLFxuICAgICAgICAgICAgMjc6ICdlc2MnLFxuICAgICAgICAgICAgMzI6ICdzcGFjZScsXG4gICAgICAgICAgICAzMzogJ3BhZ2V1cCcsXG4gICAgICAgICAgICAzNDogJ3BhZ2Vkb3duJyxcbiAgICAgICAgICAgIDM1OiAnZW5kJyxcbiAgICAgICAgICAgIDM2OiAnaG9tZScsXG4gICAgICAgICAgICAzNzogJ2xlZnQnLFxuICAgICAgICAgICAgMzg6ICd1cCcsXG4gICAgICAgICAgICAzOTogJ3JpZ2h0JyxcbiAgICAgICAgICAgIDQwOiAnZG93bicsXG4gICAgICAgICAgICA0NTogJ2lucycsXG4gICAgICAgICAgICA0NjogJ2RlbCcsXG4gICAgICAgICAgICA5MTogJ21ldGEnLFxuICAgICAgICAgICAgOTM6ICdtZXRhJyxcbiAgICAgICAgICAgIDIyNDogJ21ldGEnXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIG1hcHBpbmcgZm9yIHNwZWNpYWwgY2hhcmFjdGVycyBzbyB0aGV5IGNhbiBzdXBwb3J0XG4gICAgICAgICAqXG4gICAgICAgICAqIHRoaXMgZGljdGlvbmFyeSBpcyBvbmx5IHVzZWQgaW5jYXNlIHlvdSB3YW50IHRvIGJpbmQgYVxuICAgICAgICAgKiBrZXl1cCBvciBrZXlkb3duIGV2ZW50IHRvIG9uZSBvZiB0aGVzZSBrZXlzXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBfS0VZQ09ERV9NQVAgPSB7XG4gICAgICAgICAgICAxMDY6ICcqJyxcbiAgICAgICAgICAgIDEwNzogJysnLFxuICAgICAgICAgICAgMTA5OiAnLScsXG4gICAgICAgICAgICAxMTA6ICcuJyxcbiAgICAgICAgICAgIDExMSA6ICcvJyxcbiAgICAgICAgICAgIDE4NjogJzsnLFxuICAgICAgICAgICAgMTg3OiAnPScsXG4gICAgICAgICAgICAxODg6ICcsJyxcbiAgICAgICAgICAgIDE4OTogJy0nLFxuICAgICAgICAgICAgMTkwOiAnLicsXG4gICAgICAgICAgICAxOTE6ICcvJyxcbiAgICAgICAgICAgIDE5MjogJ2AnLFxuICAgICAgICAgICAgMjE5OiAnWycsXG4gICAgICAgICAgICAyMjA6ICdcXFxcJyxcbiAgICAgICAgICAgIDIyMTogJ10nLFxuICAgICAgICAgICAgMjIyOiAnXFwnJ1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB0aGlzIGlzIGEgbWFwcGluZyBvZiBrZXlzIHRoYXQgcmVxdWlyZSBzaGlmdCBvbiBhIFVTIGtleXBhZFxuICAgICAgICAgKiBiYWNrIHRvIHRoZSBub24gc2hpZnQgZXF1aXZlbGVudHNcbiAgICAgICAgICpcbiAgICAgICAgICogdGhpcyBpcyBzbyB5b3UgY2FuIHVzZSBrZXl1cCBldmVudHMgd2l0aCB0aGVzZSBrZXlzXG4gICAgICAgICAqXG4gICAgICAgICAqIG5vdGUgdGhhdCB0aGlzIHdpbGwgb25seSB3b3JrIHJlbGlhYmx5IG9uIFVTIGtleWJvYXJkc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgX1NISUZUX01BUCA9IHtcbiAgICAgICAgICAgICd+JzogJ2AnLFxuICAgICAgICAgICAgJyEnOiAnMScsXG4gICAgICAgICAgICAnQCc6ICcyJyxcbiAgICAgICAgICAgICcjJzogJzMnLFxuICAgICAgICAgICAgJyQnOiAnNCcsXG4gICAgICAgICAgICAnJSc6ICc1JyxcbiAgICAgICAgICAgICdeJzogJzYnLFxuICAgICAgICAgICAgJyYnOiAnNycsXG4gICAgICAgICAgICAnKic6ICc4JyxcbiAgICAgICAgICAgICcoJzogJzknLFxuICAgICAgICAgICAgJyknOiAnMCcsXG4gICAgICAgICAgICAnXyc6ICctJyxcbiAgICAgICAgICAgICcrJzogJz0nLFxuICAgICAgICAgICAgJzonOiAnOycsXG4gICAgICAgICAgICAnXFxcIic6ICdcXCcnLFxuICAgICAgICAgICAgJzwnOiAnLCcsXG4gICAgICAgICAgICAnPic6ICcuJyxcbiAgICAgICAgICAgICc/JzogJy8nLFxuICAgICAgICAgICAgJ3wnOiAnXFxcXCdcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogdGhpcyBpcyBhIGxpc3Qgb2Ygc3BlY2lhbCBzdHJpbmdzIHlvdSBjYW4gdXNlIHRvIG1hcFxuICAgICAgICAgKiB0byBtb2RpZmllciBrZXlzIHdoZW4geW91IHNwZWNpZnkgeW91ciBrZXlib2FyZCBzaG9ydGN1dHNcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIF9TUEVDSUFMX0FMSUFTRVMgPSB7XG4gICAgICAgICAgICAnb3B0aW9uJzogJ2FsdCcsXG4gICAgICAgICAgICAnY29tbWFuZCc6ICdtZXRhJyxcbiAgICAgICAgICAgICdyZXR1cm4nOiAnZW50ZXInLFxuICAgICAgICAgICAgJ2VzY2FwZSc6ICdlc2MnLFxuICAgICAgICAgICAgJ21vZCc6IC9NYWN8aVBvZHxpUGhvbmV8aVBhZC8udGVzdChuYXZpZ2F0b3IucGxhdGZvcm0pID8gJ21ldGEnIDogJ2N0cmwnXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHZhcmlhYmxlIHRvIHN0b3JlIHRoZSBmbGlwcGVkIHZlcnNpb24gb2YgX01BUCBmcm9tIGFib3ZlXG4gICAgICAgICAqIG5lZWRlZCB0byBjaGVjayBpZiB3ZSBzaG91bGQgdXNlIGtleXByZXNzIG9yIG5vdCB3aGVuIG5vIGFjdGlvblxuICAgICAgICAgKiBpcyBzcGVjaWZpZWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge09iamVjdHx1bmRlZmluZWR9XG4gICAgICAgICAqL1xuICAgICAgICBfUkVWRVJTRV9NQVAsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGEgbGlzdCBvZiBhbGwgdGhlIGNhbGxiYWNrcyBzZXR1cCB2aWEgTW91c2V0cmFwLmJpbmQoKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgX2NhbGxiYWNrcyA9IHt9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBkaXJlY3QgbWFwIG9mIHN0cmluZyBjb21iaW5hdGlvbnMgdG8gY2FsbGJhY2tzIHVzZWQgZm9yIHRyaWdnZXIoKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgX2RpcmVjdE1hcCA9IHt9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBrZWVwcyB0cmFjayBvZiB3aGF0IGxldmVsIGVhY2ggc2VxdWVuY2UgaXMgYXQgc2luY2UgbXVsdGlwbGVcbiAgICAgICAgICogc2VxdWVuY2VzIGNhbiBzdGFydCBvdXQgd2l0aCB0aGUgc2FtZSBzZXF1ZW5jZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgX3NlcXVlbmNlTGV2ZWxzID0ge30sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHZhcmlhYmxlIHRvIHN0b3JlIHRoZSBzZXRUaW1lb3V0IGNhbGxcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bGx8bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgX3Jlc2V0VGltZXIsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHRlbXBvcmFyeSBzdGF0ZSB3aGVyZSB3ZSB3aWxsIGlnbm9yZSB0aGUgbmV4dCBrZXl1cFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbnxzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBfaWdub3JlTmV4dEtleXVwID0gZmFsc2UsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHRlbXBvcmFyeSBzdGF0ZSB3aGVyZSB3ZSB3aWxsIGlnbm9yZSB0aGUgbmV4dCBrZXlwcmVzc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIF9pZ25vcmVOZXh0S2V5cHJlc3MgPSBmYWxzZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogYXJlIHdlIGN1cnJlbnRseSBpbnNpZGUgb2YgYSBzZXF1ZW5jZT9cbiAgICAgICAgICogdHlwZSBvZiBhY3Rpb24gKFwia2V5dXBcIiBvciBcImtleWRvd25cIiBvciBcImtleXByZXNzXCIpIG9yIGZhbHNlXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufHN0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIF9uZXh0RXhwZWN0ZWRBY3Rpb24gPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIGxvb3AgdGhyb3VnaCB0aGUgZiBrZXlzLCBmMSB0byBmMTkgYW5kIGFkZCB0aGVtIHRvIHRoZSBtYXBcbiAgICAgKiBwcm9ncmFtYXRpY2FsbHlcbiAgICAgKi9cbiAgICBmb3IgKHZhciBpID0gMTsgaSA8IDIwOyArK2kpIHtcbiAgICAgICAgX01BUFsxMTEgKyBpXSA9ICdmJyArIGk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogbG9vcCB0aHJvdWdoIHRvIG1hcCBudW1iZXJzIG9uIHRoZSBudW1lcmljIGtleXBhZFxuICAgICAqL1xuICAgIGZvciAoaSA9IDA7IGkgPD0gOTsgKytpKSB7XG4gICAgICAgIF9NQVBbaSArIDk2XSA9IGk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY3Jvc3MgYnJvd3NlciBhZGQgZXZlbnQgbWV0aG9kXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0VsZW1lbnR8SFRNTERvY3VtZW50fSBvYmplY3RcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAgICogQHJldHVybnMgdm9pZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9hZGRFdmVudChvYmplY3QsIHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChvYmplY3QuYWRkRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICAgICAgb2JqZWN0LmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgY2FsbGJhY2ssIGZhbHNlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIG9iamVjdC5hdHRhY2hFdmVudCgnb24nICsgdHlwZSwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHRha2VzIHRoZSBldmVudCBhbmQgcmV0dXJucyB0aGUga2V5IGNoYXJhY3RlclxuICAgICAqXG4gICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAqIEByZXR1cm4ge3N0cmluZ31cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfY2hhcmFjdGVyRnJvbUV2ZW50KGUpIHtcblxuICAgICAgICAvLyBmb3Iga2V5cHJlc3MgZXZlbnRzIHdlIHNob3VsZCByZXR1cm4gdGhlIGNoYXJhY3RlciBhcyBpc1xuICAgICAgICBpZiAoZS50eXBlID09ICdrZXlwcmVzcycpIHtcbiAgICAgICAgICAgIHZhciBjaGFyYWN0ZXIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGUud2hpY2gpO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgc2hpZnQga2V5IGlzIG5vdCBwcmVzc2VkIHRoZW4gaXQgaXMgc2FmZSB0byBhc3N1bWVcbiAgICAgICAgICAgIC8vIHRoYXQgd2Ugd2FudCB0aGUgY2hhcmFjdGVyIHRvIGJlIGxvd2VyY2FzZS4gIHRoaXMgbWVhbnMgaWZcbiAgICAgICAgICAgIC8vIHlvdSBhY2NpZGVudGFsbHkgaGF2ZSBjYXBzIGxvY2sgb24gdGhlbiB5b3VyIGtleSBiaW5kaW5nc1xuICAgICAgICAgICAgLy8gd2lsbCBjb250aW51ZSB0byB3b3JrXG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gdGhlIG9ubHkgc2lkZSBlZmZlY3QgdGhhdCBtaWdodCBub3QgYmUgZGVzaXJlZCBpcyBpZiB5b3VcbiAgICAgICAgICAgIC8vIGJpbmQgc29tZXRoaW5nIGxpa2UgJ0EnIGNhdXNlIHlvdSB3YW50IHRvIHRyaWdnZXIgYW5cbiAgICAgICAgICAgIC8vIGV2ZW50IHdoZW4gY2FwaXRhbCBBIGlzIHByZXNzZWQgY2FwcyBsb2NrIHdpbGwgbm8gbG9uZ2VyXG4gICAgICAgICAgICAvLyB0cmlnZ2VyIHRoZSBldmVudC4gIHNoaWZ0K2Egd2lsbCB0aG91Z2guXG4gICAgICAgICAgICBpZiAoIWUuc2hpZnRLZXkpIHtcbiAgICAgICAgICAgICAgICBjaGFyYWN0ZXIgPSBjaGFyYWN0ZXIudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGNoYXJhY3RlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZvciBub24ga2V5cHJlc3MgZXZlbnRzIHRoZSBzcGVjaWFsIG1hcHMgYXJlIG5lZWRlZFxuICAgICAgICBpZiAoX01BUFtlLndoaWNoXSkge1xuICAgICAgICAgICAgcmV0dXJuIF9NQVBbZS53aGljaF07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoX0tFWUNPREVfTUFQW2Uud2hpY2hdKSB7XG4gICAgICAgICAgICByZXR1cm4gX0tFWUNPREVfTUFQW2Uud2hpY2hdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgaXQgaXMgbm90IGluIHRoZSBzcGVjaWFsIG1hcFxuXG4gICAgICAgIC8vIHdpdGgga2V5ZG93biBhbmQga2V5dXAgZXZlbnRzIHRoZSBjaGFyYWN0ZXIgc2VlbXMgdG8gYWx3YXlzXG4gICAgICAgIC8vIGNvbWUgaW4gYXMgYW4gdXBwZXJjYXNlIGNoYXJhY3RlciB3aGV0aGVyIHlvdSBhcmUgcHJlc3Npbmcgc2hpZnRcbiAgICAgICAgLy8gb3Igbm90LiAgd2Ugc2hvdWxkIG1ha2Ugc3VyZSBpdCBpcyBhbHdheXMgbG93ZXJjYXNlIGZvciBjb21wYXJpc29uc1xuICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShlLndoaWNoKS50b0xvd2VyQ2FzZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBpZiB0d28gYXJyYXlzIGFyZSBlcXVhbFxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gbW9kaWZpZXJzMVxuICAgICAqIEBwYXJhbSB7QXJyYXl9IG1vZGlmaWVyczJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfbW9kaWZpZXJzTWF0Y2gobW9kaWZpZXJzMSwgbW9kaWZpZXJzMikge1xuICAgICAgICByZXR1cm4gbW9kaWZpZXJzMS5zb3J0KCkuam9pbignLCcpID09PSBtb2RpZmllcnMyLnNvcnQoKS5qb2luKCcsJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmVzZXRzIGFsbCBzZXF1ZW5jZSBjb3VudGVycyBleGNlcHQgZm9yIHRoZSBvbmVzIHBhc3NlZCBpblxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRvTm90UmVzZXRcbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX3Jlc2V0U2VxdWVuY2VzKGRvTm90UmVzZXQpIHtcbiAgICAgICAgZG9Ob3RSZXNldCA9IGRvTm90UmVzZXQgfHwge307XG5cbiAgICAgICAgdmFyIGFjdGl2ZVNlcXVlbmNlcyA9IGZhbHNlLFxuICAgICAgICAgICAga2V5O1xuXG4gICAgICAgIGZvciAoa2V5IGluIF9zZXF1ZW5jZUxldmVscykge1xuICAgICAgICAgICAgaWYgKGRvTm90UmVzZXRba2V5XSkge1xuICAgICAgICAgICAgICAgIGFjdGl2ZVNlcXVlbmNlcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBfc2VxdWVuY2VMZXZlbHNba2V5XSA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWFjdGl2ZVNlcXVlbmNlcykge1xuICAgICAgICAgICAgX25leHRFeHBlY3RlZEFjdGlvbiA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogZmluZHMgYWxsIGNhbGxiYWNrcyB0aGF0IG1hdGNoIGJhc2VkIG9uIHRoZSBrZXljb2RlLCBtb2RpZmllcnMsXG4gICAgICogYW5kIGFjdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNoYXJhY3RlclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IG1vZGlmaWVyc1xuICAgICAqIEBwYXJhbSB7RXZlbnR8T2JqZWN0fSBlXG4gICAgICogQHBhcmFtIHtzdHJpbmc9fSBzZXF1ZW5jZU5hbWUgLSBuYW1lIG9mIHRoZSBzZXF1ZW5jZSB3ZSBhcmUgbG9va2luZyBmb3JcbiAgICAgKiBAcGFyYW0ge3N0cmluZz19IGNvbWJpbmF0aW9uXG4gICAgICogQHBhcmFtIHtudW1iZXI9fSBsZXZlbFxuICAgICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfZ2V0TWF0Y2hlcyhjaGFyYWN0ZXIsIG1vZGlmaWVycywgZSwgc2VxdWVuY2VOYW1lLCBjb21iaW5hdGlvbiwgbGV2ZWwpIHtcbiAgICAgICAgdmFyIGksXG4gICAgICAgICAgICBjYWxsYmFjayxcbiAgICAgICAgICAgIG1hdGNoZXMgPSBbXSxcbiAgICAgICAgICAgIGFjdGlvbiA9IGUudHlwZTtcblxuICAgICAgICAvLyBpZiB0aGVyZSBhcmUgbm8gZXZlbnRzIHJlbGF0ZWQgdG8gdGhpcyBrZXljb2RlXG4gICAgICAgIGlmICghX2NhbGxiYWNrc1tjaGFyYWN0ZXJdKSB7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiBhIG1vZGlmaWVyIGtleSBpcyBjb21pbmcgdXAgb24gaXRzIG93biB3ZSBzaG91bGQgYWxsb3cgaXRcbiAgICAgICAgaWYgKGFjdGlvbiA9PSAna2V5dXAnICYmIF9pc01vZGlmaWVyKGNoYXJhY3RlcikpIHtcbiAgICAgICAgICAgIG1vZGlmaWVycyA9IFtjaGFyYWN0ZXJdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbG9vcCB0aHJvdWdoIGFsbCBjYWxsYmFja3MgZm9yIHRoZSBrZXkgdGhhdCB3YXMgcHJlc3NlZFxuICAgICAgICAvLyBhbmQgc2VlIGlmIGFueSBvZiB0aGVtIG1hdGNoXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBfY2FsbGJhY2tzW2NoYXJhY3Rlcl0ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gX2NhbGxiYWNrc1tjaGFyYWN0ZXJdW2ldO1xuXG4gICAgICAgICAgICAvLyBpZiBhIHNlcXVlbmNlIG5hbWUgaXMgbm90IHNwZWNpZmllZCwgYnV0IHRoaXMgaXMgYSBzZXF1ZW5jZSBhdFxuICAgICAgICAgICAgLy8gdGhlIHdyb25nIGxldmVsIHRoZW4gbW92ZSBvbnRvIHRoZSBuZXh0IG1hdGNoXG4gICAgICAgICAgICBpZiAoIXNlcXVlbmNlTmFtZSAmJiBjYWxsYmFjay5zZXEgJiYgX3NlcXVlbmNlTGV2ZWxzW2NhbGxiYWNrLnNlcV0gIT0gY2FsbGJhY2subGV2ZWwpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdGhlIGFjdGlvbiB3ZSBhcmUgbG9va2luZyBmb3IgZG9lc24ndCBtYXRjaCB0aGUgYWN0aW9uIHdlIGdvdFxuICAgICAgICAgICAgLy8gdGhlbiB3ZSBzaG91bGQga2VlcCBnb2luZ1xuICAgICAgICAgICAgaWYgKGFjdGlvbiAhPSBjYWxsYmFjay5hY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdGhpcyBpcyBhIGtleXByZXNzIGV2ZW50IGFuZCB0aGUgbWV0YSBrZXkgYW5kIGNvbnRyb2wga2V5XG4gICAgICAgICAgICAvLyBhcmUgbm90IHByZXNzZWQgdGhhdCBtZWFucyB0aGF0IHdlIG5lZWQgdG8gb25seSBsb29rIGF0IHRoZVxuICAgICAgICAgICAgLy8gY2hhcmFjdGVyLCBvdGhlcndpc2UgY2hlY2sgdGhlIG1vZGlmaWVycyBhcyB3ZWxsXG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gY2hyb21lIHdpbGwgbm90IGZpcmUgYSBrZXlwcmVzcyBpZiBtZXRhIG9yIGNvbnRyb2wgaXMgZG93blxuICAgICAgICAgICAgLy8gc2FmYXJpIHdpbGwgZmlyZSBhIGtleXByZXNzIGlmIG1ldGEgb3IgbWV0YStzaGlmdCBpcyBkb3duXG4gICAgICAgICAgICAvLyBmaXJlZm94IHdpbGwgZmlyZSBhIGtleXByZXNzIGlmIG1ldGEgb3IgY29udHJvbCBpcyBkb3duXG4gICAgICAgICAgICBpZiAoKGFjdGlvbiA9PSAna2V5cHJlc3MnICYmICFlLm1ldGFLZXkgJiYgIWUuY3RybEtleSkgfHwgX21vZGlmaWVyc01hdGNoKG1vZGlmaWVycywgY2FsbGJhY2subW9kaWZpZXJzKSkge1xuXG4gICAgICAgICAgICAgICAgLy8gd2hlbiB5b3UgYmluZCBhIGNvbWJpbmF0aW9uIG9yIHNlcXVlbmNlIGEgc2Vjb25kIHRpbWUgaXRcbiAgICAgICAgICAgICAgICAvLyBzaG91bGQgb3ZlcndyaXRlIHRoZSBmaXJzdCBvbmUuICBpZiBhIHNlcXVlbmNlTmFtZSBvclxuICAgICAgICAgICAgICAgIC8vIGNvbWJpbmF0aW9uIGlzIHNwZWNpZmllZCBpbiB0aGlzIGNhbGwgaXQgZG9lcyBqdXN0IHRoYXRcbiAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgIC8vIEB0b2RvIG1ha2UgZGVsZXRpbmcgaXRzIG93biBtZXRob2Q/XG4gICAgICAgICAgICAgICAgdmFyIGRlbGV0ZUNvbWJvID0gIXNlcXVlbmNlTmFtZSAmJiBjYWxsYmFjay5jb21ibyA9PSBjb21iaW5hdGlvbjtcbiAgICAgICAgICAgICAgICB2YXIgZGVsZXRlU2VxdWVuY2UgPSBzZXF1ZW5jZU5hbWUgJiYgY2FsbGJhY2suc2VxID09IHNlcXVlbmNlTmFtZSAmJiBjYWxsYmFjay5sZXZlbCA9PSBsZXZlbDtcbiAgICAgICAgICAgICAgICBpZiAoZGVsZXRlQ29tYm8gfHwgZGVsZXRlU2VxdWVuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgX2NhbGxiYWNrc1tjaGFyYWN0ZXJdLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtYXRjaGVzLnB1c2goY2FsbGJhY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG1hdGNoZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogdGFrZXMgYSBrZXkgZXZlbnQgYW5kIGZpZ3VyZXMgb3V0IHdoYXQgdGhlIG1vZGlmaWVycyBhcmVcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2V2ZW50TW9kaWZpZXJzKGUpIHtcbiAgICAgICAgdmFyIG1vZGlmaWVycyA9IFtdO1xuXG4gICAgICAgIGlmIChlLnNoaWZ0S2V5KSB7XG4gICAgICAgICAgICBtb2RpZmllcnMucHVzaCgnc2hpZnQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlLmFsdEtleSkge1xuICAgICAgICAgICAgbW9kaWZpZXJzLnB1c2goJ2FsdCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGUuY3RybEtleSkge1xuICAgICAgICAgICAgbW9kaWZpZXJzLnB1c2goJ2N0cmwnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlLm1ldGFLZXkpIHtcbiAgICAgICAgICAgIG1vZGlmaWVycy5wdXNoKCdtZXRhJyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbW9kaWZpZXJzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHByZXZlbnRzIGRlZmF1bHQgZm9yIHRoaXMgZXZlbnRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX3ByZXZlbnREZWZhdWx0KGUpIHtcbiAgICAgICAgaWYgKGUucHJldmVudERlZmF1bHQpIHtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGUucmV0dXJuVmFsdWUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBzdG9wcyBwcm9wb2dhdGlvbiBmb3IgdGhpcyBldmVudFxuICAgICAqXG4gICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfc3RvcFByb3BhZ2F0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUuc3RvcFByb3BhZ2F0aW9uKSB7XG4gICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZS5jYW5jZWxCdWJibGUgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGFjdHVhbGx5IGNhbGxzIHRoZSBjYWxsYmFjayBmdW5jdGlvblxuICAgICAqXG4gICAgICogaWYgeW91ciBjYWxsYmFjayBmdW5jdGlvbiByZXR1cm5zIGZhbHNlIHRoaXMgd2lsbCB1c2UgdGhlIGpxdWVyeVxuICAgICAqIGNvbnZlbnRpb24gLSBwcmV2ZW50IGRlZmF1bHQgYW5kIHN0b3AgcHJvcG9nYXRpb24gb24gdGhlIGV2ZW50XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2ZpcmVDYWxsYmFjayhjYWxsYmFjaywgZSwgY29tYm8sIHNlcXVlbmNlKSB7XG5cbiAgICAgICAgLy8gaWYgdGhpcyBldmVudCBzaG91bGQgbm90IGhhcHBlbiBzdG9wIGhlcmVcbiAgICAgICAgaWYgKE1vdXNldHJhcC5zdG9wQ2FsbGJhY2soZSwgZS50YXJnZXQgfHwgZS5zcmNFbGVtZW50LCBjb21ibywgc2VxdWVuY2UpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2FsbGJhY2soZSwgY29tYm8pID09PSBmYWxzZSkge1xuICAgICAgICAgICAgX3ByZXZlbnREZWZhdWx0KGUpO1xuICAgICAgICAgICAgX3N0b3BQcm9wYWdhdGlvbihlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGhhbmRsZXMgYSBjaGFyYWN0ZXIga2V5IGV2ZW50XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2hhcmFjdGVyXG4gICAgICogQHBhcmFtIHtBcnJheX0gbW9kaWZpZXJzXG4gICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfaGFuZGxlS2V5KGNoYXJhY3RlciwgbW9kaWZpZXJzLCBlKSB7XG4gICAgICAgIHZhciBjYWxsYmFja3MgPSBfZ2V0TWF0Y2hlcyhjaGFyYWN0ZXIsIG1vZGlmaWVycywgZSksXG4gICAgICAgICAgICBpLFxuICAgICAgICAgICAgZG9Ob3RSZXNldCA9IHt9LFxuICAgICAgICAgICAgbWF4TGV2ZWwgPSAwLFxuICAgICAgICAgICAgcHJvY2Vzc2VkU2VxdWVuY2VDYWxsYmFjayA9IGZhbHNlO1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSB0aGUgbWF4TGV2ZWwgZm9yIHNlcXVlbmNlcyBzbyB3ZSBjYW4gb25seSBleGVjdXRlIHRoZSBsb25nZXN0IGNhbGxiYWNrIHNlcXVlbmNlXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFja3NbaV0uc2VxKSB7XG4gICAgICAgICAgICAgICAgbWF4TGV2ZWwgPSBNYXRoLm1heChtYXhMZXZlbCwgY2FsbGJhY2tzW2ldLmxldmVsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGxvb3AgdGhyb3VnaCBtYXRjaGluZyBjYWxsYmFja3MgZm9yIHRoaXMga2V5IGV2ZW50XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyArK2kpIHtcblxuICAgICAgICAgICAgLy8gZmlyZSBmb3IgYWxsIHNlcXVlbmNlIGNhbGxiYWNrc1xuICAgICAgICAgICAgLy8gdGhpcyBpcyBiZWNhdXNlIGlmIGZvciBleGFtcGxlIHlvdSBoYXZlIG11bHRpcGxlIHNlcXVlbmNlc1xuICAgICAgICAgICAgLy8gYm91bmQgc3VjaCBhcyBcImcgaVwiIGFuZCBcImcgdFwiIHRoZXkgYm90aCBuZWVkIHRvIGZpcmUgdGhlXG4gICAgICAgICAgICAvLyBjYWxsYmFjayBmb3IgbWF0Y2hpbmcgZyBjYXVzZSBvdGhlcndpc2UgeW91IGNhbiBvbmx5IGV2ZXJcbiAgICAgICAgICAgIC8vIG1hdGNoIHRoZSBmaXJzdCBvbmVcbiAgICAgICAgICAgIGlmIChjYWxsYmFja3NbaV0uc2VxKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBvbmx5IGZpcmUgY2FsbGJhY2tzIGZvciB0aGUgbWF4TGV2ZWwgdG8gcHJldmVudFxuICAgICAgICAgICAgICAgIC8vIHN1YnNlcXVlbmNlcyBmcm9tIGFsc28gZmlyaW5nXG4gICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAvLyBmb3IgZXhhbXBsZSAnYSBvcHRpb24gYicgc2hvdWxkIG5vdCBjYXVzZSAnb3B0aW9uIGInIHRvIGZpcmVcbiAgICAgICAgICAgICAgICAvLyBldmVuIHRob3VnaCAnb3B0aW9uIGInIGlzIHBhcnQgb2YgdGhlIG90aGVyIHNlcXVlbmNlXG4gICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAvLyBhbnkgc2VxdWVuY2VzIHRoYXQgZG8gbm90IG1hdGNoIGhlcmUgd2lsbCBiZSBkaXNjYXJkZWRcbiAgICAgICAgICAgICAgICAvLyBiZWxvdyBieSB0aGUgX3Jlc2V0U2VxdWVuY2VzIGNhbGxcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2tzW2ldLmxldmVsICE9IG1heExldmVsKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHByb2Nlc3NlZFNlcXVlbmNlQ2FsbGJhY2sgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgLy8ga2VlcCBhIGxpc3Qgb2Ygd2hpY2ggc2VxdWVuY2VzIHdlcmUgbWF0Y2hlcyBmb3IgbGF0ZXJcbiAgICAgICAgICAgICAgICBkb05vdFJlc2V0W2NhbGxiYWNrc1tpXS5zZXFdID0gMTtcbiAgICAgICAgICAgICAgICBfZmlyZUNhbGxiYWNrKGNhbGxiYWNrc1tpXS5jYWxsYmFjaywgZSwgY2FsbGJhY2tzW2ldLmNvbWJvLCBjYWxsYmFja3NbaV0uc2VxKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdGhlcmUgd2VyZSBubyBzZXF1ZW5jZSBtYXRjaGVzIGJ1dCB3ZSBhcmUgc3RpbGwgaGVyZVxuICAgICAgICAgICAgLy8gdGhhdCBtZWFucyB0aGlzIGlzIGEgcmVndWxhciBtYXRjaCBzbyB3ZSBzaG91bGQgZmlyZSB0aGF0XG4gICAgICAgICAgICBpZiAoIXByb2Nlc3NlZFNlcXVlbmNlQ2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBfZmlyZUNhbGxiYWNrKGNhbGxiYWNrc1tpXS5jYWxsYmFjaywgZSwgY2FsbGJhY2tzW2ldLmNvbWJvKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHRoZSBrZXkgeW91IHByZXNzZWQgbWF0Y2hlcyB0aGUgdHlwZSBvZiBzZXF1ZW5jZSB3aXRob3V0XG4gICAgICAgIC8vIGJlaW5nIGEgbW9kaWZpZXIgKGllIFwia2V5dXBcIiBvciBcImtleXByZXNzXCIpIHRoZW4gd2Ugc2hvdWxkXG4gICAgICAgIC8vIHJlc2V0IGFsbCBzZXF1ZW5jZXMgdGhhdCB3ZXJlIG5vdCBtYXRjaGVkIGJ5IHRoaXMgZXZlbnRcbiAgICAgICAgLy9cbiAgICAgICAgLy8gdGhpcyBpcyBzbywgZm9yIGV4YW1wbGUsIGlmIHlvdSBoYXZlIHRoZSBzZXF1ZW5jZSBcImggYSB0XCIgYW5kIHlvdVxuICAgICAgICAvLyB0eXBlIFwiaCBlIGEgciB0XCIgaXQgZG9lcyBub3QgbWF0Y2guICBpbiB0aGlzIGNhc2UgdGhlIFwiZVwiIHdpbGxcbiAgICAgICAgLy8gY2F1c2UgdGhlIHNlcXVlbmNlIHRvIHJlc2V0XG4gICAgICAgIC8vXG4gICAgICAgIC8vIG1vZGlmaWVyIGtleXMgYXJlIGlnbm9yZWQgYmVjYXVzZSB5b3UgY2FuIGhhdmUgYSBzZXF1ZW5jZVxuICAgICAgICAvLyB0aGF0IGNvbnRhaW5zIG1vZGlmaWVycyBzdWNoIGFzIFwiZW50ZXIgY3RybCtzcGFjZVwiIGFuZCBpbiBtb3N0XG4gICAgICAgIC8vIGNhc2VzIHRoZSBtb2RpZmllciBrZXkgd2lsbCBiZSBwcmVzc2VkIGJlZm9yZSB0aGUgbmV4dCBrZXlcbiAgICAgICAgLy9cbiAgICAgICAgLy8gYWxzbyBpZiB5b3UgaGF2ZSBhIHNlcXVlbmNlIHN1Y2ggYXMgXCJjdHJsK2IgYVwiIHRoZW4gcHJlc3NpbmcgdGhlXG4gICAgICAgIC8vIFwiYlwiIGtleSB3aWxsIHRyaWdnZXIgYSBcImtleXByZXNzXCIgYW5kIGEgXCJrZXlkb3duXCJcbiAgICAgICAgLy9cbiAgICAgICAgLy8gdGhlIFwia2V5ZG93blwiIGlzIGV4cGVjdGVkIHdoZW4gdGhlcmUgaXMgYSBtb2RpZmllciwgYnV0IHRoZVxuICAgICAgICAvLyBcImtleXByZXNzXCIgZW5kcyB1cCBtYXRjaGluZyB0aGUgX25leHRFeHBlY3RlZEFjdGlvbiBzaW5jZSBpdCBvY2N1cnNcbiAgICAgICAgLy8gYWZ0ZXIgYW5kIHRoYXQgY2F1c2VzIHRoZSBzZXF1ZW5jZSB0byByZXNldFxuICAgICAgICAvL1xuICAgICAgICAvLyB3ZSBpZ25vcmUga2V5cHJlc3NlcyBpbiBhIHNlcXVlbmNlIHRoYXQgZGlyZWN0bHkgZm9sbG93IGEga2V5ZG93blxuICAgICAgICAvLyBmb3IgdGhlIHNhbWUgY2hhcmFjdGVyXG4gICAgICAgIHZhciBpZ25vcmVUaGlzS2V5cHJlc3MgPSBlLnR5cGUgPT0gJ2tleXByZXNzJyAmJiBfaWdub3JlTmV4dEtleXByZXNzO1xuICAgICAgICBpZiAoZS50eXBlID09IF9uZXh0RXhwZWN0ZWRBY3Rpb24gJiYgIV9pc01vZGlmaWVyKGNoYXJhY3RlcikgJiYgIWlnbm9yZVRoaXNLZXlwcmVzcykge1xuICAgICAgICAgICAgX3Jlc2V0U2VxdWVuY2VzKGRvTm90UmVzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgX2lnbm9yZU5leHRLZXlwcmVzcyA9IHByb2Nlc3NlZFNlcXVlbmNlQ2FsbGJhY2sgJiYgZS50eXBlID09ICdrZXlkb3duJztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBoYW5kbGVzIGEga2V5ZG93biBldmVudFxuICAgICAqXG4gICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfaGFuZGxlS2V5RXZlbnQoZSkge1xuXG4gICAgICAgIC8vIG5vcm1hbGl6ZSBlLndoaWNoIGZvciBrZXkgZXZlbnRzXG4gICAgICAgIC8vIEBzZWUgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy80Mjg1NjI3L2phdmFzY3JpcHQta2V5Y29kZS12cy1jaGFyY29kZS11dHRlci1jb25mdXNpb25cbiAgICAgICAgaWYgKHR5cGVvZiBlLndoaWNoICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgZS53aGljaCA9IGUua2V5Q29kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjaGFyYWN0ZXIgPSBfY2hhcmFjdGVyRnJvbUV2ZW50KGUpO1xuXG4gICAgICAgIC8vIG5vIGNoYXJhY3RlciBmb3VuZCB0aGVuIHN0b3BcbiAgICAgICAgaWYgKCFjaGFyYWN0ZXIpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5lZWQgdG8gdXNlID09PSBmb3IgdGhlIGNoYXJhY3RlciBjaGVjayBiZWNhdXNlIHRoZSBjaGFyYWN0ZXIgY2FuIGJlIDBcbiAgICAgICAgaWYgKGUudHlwZSA9PSAna2V5dXAnICYmIF9pZ25vcmVOZXh0S2V5dXAgPT09IGNoYXJhY3Rlcikge1xuICAgICAgICAgICAgX2lnbm9yZU5leHRLZXl1cCA9IGZhbHNlO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgTW91c2V0cmFwLmhhbmRsZUtleShjaGFyYWN0ZXIsIF9ldmVudE1vZGlmaWVycyhlKSwgZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogZGV0ZXJtaW5lcyBpZiB0aGUga2V5Y29kZSBzcGVjaWZpZWQgaXMgYSBtb2RpZmllciBrZXkgb3Igbm90XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5XG4gICAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2lzTW9kaWZpZXIoa2V5KSB7XG4gICAgICAgIHJldHVybiBrZXkgPT0gJ3NoaWZ0JyB8fCBrZXkgPT0gJ2N0cmwnIHx8IGtleSA9PSAnYWx0JyB8fCBrZXkgPT0gJ21ldGEnO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNhbGxlZCB0byBzZXQgYSAxIHNlY29uZCB0aW1lb3V0IG9uIHRoZSBzcGVjaWZpZWQgc2VxdWVuY2VcbiAgICAgKlxuICAgICAqIHRoaXMgaXMgc28gYWZ0ZXIgZWFjaCBrZXkgcHJlc3MgaW4gdGhlIHNlcXVlbmNlIHlvdSBoYXZlIDEgc2Vjb25kXG4gICAgICogdG8gcHJlc3MgdGhlIG5leHQga2V5IGJlZm9yZSB5b3UgaGF2ZSB0byBzdGFydCBvdmVyXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX3Jlc2V0U2VxdWVuY2VUaW1lcigpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KF9yZXNldFRpbWVyKTtcbiAgICAgICAgX3Jlc2V0VGltZXIgPSBzZXRUaW1lb3V0KF9yZXNldFNlcXVlbmNlcywgMTAwMCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmV2ZXJzZXMgdGhlIG1hcCBsb29rdXAgc28gdGhhdCB3ZSBjYW4gbG9vayBmb3Igc3BlY2lmaWMga2V5c1xuICAgICAqIHRvIHNlZSB3aGF0IGNhbiBhbmQgY2FuJ3QgdXNlIGtleXByZXNzXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2dldFJldmVyc2VNYXAoKSB7XG4gICAgICAgIGlmICghX1JFVkVSU0VfTUFQKSB7XG4gICAgICAgICAgICBfUkVWRVJTRV9NQVAgPSB7fTtcbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBfTUFQKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBwdWxsIG91dCB0aGUgbnVtZXJpYyBrZXlwYWQgZnJvbSBoZXJlIGNhdXNlIGtleXByZXNzIHNob3VsZFxuICAgICAgICAgICAgICAgIC8vIGJlIGFibGUgdG8gZGV0ZWN0IHRoZSBrZXlzIGZyb20gdGhlIGNoYXJhY3RlclxuICAgICAgICAgICAgICAgIGlmIChrZXkgPiA5NSAmJiBrZXkgPCAxMTIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKF9NQVAuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICBfUkVWRVJTRV9NQVBbX01BUFtrZXldXSA9IGtleTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9SRVZFUlNFX01BUDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBwaWNrcyB0aGUgYmVzdCBhY3Rpb24gYmFzZWQgb24gdGhlIGtleSBjb21iaW5hdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIGNoYXJhY3RlciBmb3Iga2V5XG4gICAgICogQHBhcmFtIHtBcnJheX0gbW9kaWZpZXJzXG4gICAgICogQHBhcmFtIHtzdHJpbmc9fSBhY3Rpb24gcGFzc2VkIGluXG4gICAgICovXG4gICAgZnVuY3Rpb24gX3BpY2tCZXN0QWN0aW9uKGtleSwgbW9kaWZpZXJzLCBhY3Rpb24pIHtcblxuICAgICAgICAvLyBpZiBubyBhY3Rpb24gd2FzIHBpY2tlZCBpbiB3ZSBzaG91bGQgdHJ5IHRvIHBpY2sgdGhlIG9uZVxuICAgICAgICAvLyB0aGF0IHdlIHRoaW5rIHdvdWxkIHdvcmsgYmVzdCBmb3IgdGhpcyBrZXlcbiAgICAgICAgaWYgKCFhY3Rpb24pIHtcbiAgICAgICAgICAgIGFjdGlvbiA9IF9nZXRSZXZlcnNlTWFwKClba2V5XSA/ICdrZXlkb3duJyA6ICdrZXlwcmVzcyc7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtb2RpZmllciBrZXlzIGRvbid0IHdvcmsgYXMgZXhwZWN0ZWQgd2l0aCBrZXlwcmVzcyxcbiAgICAgICAgLy8gc3dpdGNoIHRvIGtleWRvd25cbiAgICAgICAgaWYgKGFjdGlvbiA9PSAna2V5cHJlc3MnICYmIG1vZGlmaWVycy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGFjdGlvbiA9ICdrZXlkb3duJztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhY3Rpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYmluZHMgYSBrZXkgc2VxdWVuY2UgdG8gYW4gZXZlbnRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb21ibyAtIGNvbWJvIHNwZWNpZmllZCBpbiBiaW5kIGNhbGxcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBrZXlzXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgKiBAcGFyYW0ge3N0cmluZz19IGFjdGlvblxuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfYmluZFNlcXVlbmNlKGNvbWJvLCBrZXlzLCBjYWxsYmFjaywgYWN0aW9uKSB7XG5cbiAgICAgICAgLy8gc3RhcnQgb2ZmIGJ5IGFkZGluZyBhIHNlcXVlbmNlIGxldmVsIHJlY29yZCBmb3IgdGhpcyBjb21iaW5hdGlvblxuICAgICAgICAvLyBhbmQgc2V0dGluZyB0aGUgbGV2ZWwgdG8gMFxuICAgICAgICBfc2VxdWVuY2VMZXZlbHNbY29tYm9dID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogY2FsbGJhY2sgdG8gaW5jcmVhc2UgdGhlIHNlcXVlbmNlIGxldmVsIGZvciB0aGlzIHNlcXVlbmNlIGFuZCByZXNldFxuICAgICAgICAgKiBhbGwgb3RoZXIgc2VxdWVuY2VzIHRoYXQgd2VyZSBhY3RpdmVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IG5leHRBY3Rpb25cbiAgICAgICAgICogQHJldHVybnMge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX2luY3JlYXNlU2VxdWVuY2UobmV4dEFjdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIF9uZXh0RXhwZWN0ZWRBY3Rpb24gPSBuZXh0QWN0aW9uO1xuICAgICAgICAgICAgICAgICsrX3NlcXVlbmNlTGV2ZWxzW2NvbWJvXTtcbiAgICAgICAgICAgICAgICBfcmVzZXRTZXF1ZW5jZVRpbWVyKCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHdyYXBzIHRoZSBzcGVjaWZpZWQgY2FsbGJhY2sgaW5zaWRlIG9mIGFub3RoZXIgZnVuY3Rpb24gaW4gb3JkZXJcbiAgICAgICAgICogdG8gcmVzZXQgYWxsIHNlcXVlbmNlIGNvdW50ZXJzIGFzIHNvb24gYXMgdGhpcyBzZXF1ZW5jZSBpcyBkb25lXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgICAgICogQHJldHVybnMgdm9pZFxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX2NhbGxiYWNrQW5kUmVzZXQoZSkge1xuICAgICAgICAgICAgX2ZpcmVDYWxsYmFjayhjYWxsYmFjaywgZSwgY29tYm8pO1xuXG4gICAgICAgICAgICAvLyB3ZSBzaG91bGQgaWdub3JlIHRoZSBuZXh0IGtleSB1cCBpZiB0aGUgYWN0aW9uIGlzIGtleSBkb3duXG4gICAgICAgICAgICAvLyBvciBrZXlwcmVzcy4gIHRoaXMgaXMgc28gaWYgeW91IGZpbmlzaCBhIHNlcXVlbmNlIGFuZFxuICAgICAgICAgICAgLy8gcmVsZWFzZSB0aGUga2V5IHRoZSBmaW5hbCBrZXkgd2lsbCBub3QgdHJpZ2dlciBhIGtleXVwXG4gICAgICAgICAgICBpZiAoYWN0aW9uICE9PSAna2V5dXAnKSB7XG4gICAgICAgICAgICAgICAgX2lnbm9yZU5leHRLZXl1cCA9IF9jaGFyYWN0ZXJGcm9tRXZlbnQoZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHdlaXJkIHJhY2UgY29uZGl0aW9uIGlmIGEgc2VxdWVuY2UgZW5kcyB3aXRoIHRoZSBrZXlcbiAgICAgICAgICAgIC8vIGFub3RoZXIgc2VxdWVuY2UgYmVnaW5zIHdpdGhcbiAgICAgICAgICAgIHNldFRpbWVvdXQoX3Jlc2V0U2VxdWVuY2VzLCAxMCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBsb29wIHRocm91Z2gga2V5cyBvbmUgYXQgYSB0aW1lIGFuZCBiaW5kIHRoZSBhcHByb3ByaWF0ZSBjYWxsYmFja1xuICAgICAgICAvLyBmdW5jdGlvbi4gIGZvciBhbnkga2V5IGxlYWRpbmcgdXAgdG8gdGhlIGZpbmFsIG9uZSBpdCBzaG91bGRcbiAgICAgICAgLy8gaW5jcmVhc2UgdGhlIHNlcXVlbmNlLiBhZnRlciB0aGUgZmluYWwsIGl0IHNob3VsZCByZXNldCBhbGwgc2VxdWVuY2VzXG4gICAgICAgIC8vXG4gICAgICAgIC8vIGlmIGFuIGFjdGlvbiBpcyBzcGVjaWZpZWQgaW4gdGhlIG9yaWdpbmFsIGJpbmQgY2FsbCB0aGVuIHRoYXQgd2lsbFxuICAgICAgICAvLyBiZSB1c2VkIHRocm91Z2hvdXQuICBvdGhlcndpc2Ugd2Ugd2lsbCBwYXNzIHRoZSBhY3Rpb24gdGhhdCB0aGVcbiAgICAgICAgLy8gbmV4dCBrZXkgaW4gdGhlIHNlcXVlbmNlIHNob3VsZCBtYXRjaC4gIHRoaXMgYWxsb3dzIGEgc2VxdWVuY2VcbiAgICAgICAgLy8gdG8gbWl4IGFuZCBtYXRjaCBrZXlwcmVzcyBhbmQga2V5ZG93biBldmVudHMgZGVwZW5kaW5nIG9uIHdoaWNoXG4gICAgICAgIC8vIG9uZXMgYXJlIGJldHRlciBzdWl0ZWQgdG8gdGhlIGtleSBwcm92aWRlZFxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIHZhciBpc0ZpbmFsID0gaSArIDEgPT09IGtleXMubGVuZ3RoO1xuICAgICAgICAgICAgdmFyIHdyYXBwZWRDYWxsYmFjayA9IGlzRmluYWwgPyBfY2FsbGJhY2tBbmRSZXNldCA6IF9pbmNyZWFzZVNlcXVlbmNlKGFjdGlvbiB8fCBfZ2V0S2V5SW5mbyhrZXlzW2kgKyAxXSkuYWN0aW9uKTtcbiAgICAgICAgICAgIF9iaW5kU2luZ2xlKGtleXNbaV0sIHdyYXBwZWRDYWxsYmFjaywgYWN0aW9uLCBjb21ibywgaSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyBmcm9tIGEgc3RyaW5nIGtleSBjb21iaW5hdGlvbiB0byBhbiBhcnJheVxuICAgICAqXG4gICAgICogQHBhcmFtICB7c3RyaW5nfSBjb21iaW5hdGlvbiBsaWtlIFwiY29tbWFuZCtzaGlmdCtsXCJcbiAgICAgKiBAcmV0dXJuIHtBcnJheX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfa2V5c0Zyb21TdHJpbmcoY29tYmluYXRpb24pIHtcbiAgICAgICAgaWYgKGNvbWJpbmF0aW9uID09PSAnKycpIHtcbiAgICAgICAgICAgIHJldHVybiBbJysnXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjb21iaW5hdGlvbi5zcGxpdCgnKycpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgaW5mbyBmb3IgYSBzcGVjaWZpYyBrZXkgY29tYmluYXRpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSAge3N0cmluZ30gY29tYmluYXRpb24ga2V5IGNvbWJpbmF0aW9uIChcImNvbW1hbmQrc1wiIG9yIFwiYVwiIG9yIFwiKlwiKVxuICAgICAqIEBwYXJhbSAge3N0cmluZz19IGFjdGlvblxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2dldEtleUluZm8oY29tYmluYXRpb24sIGFjdGlvbikge1xuICAgICAgICB2YXIga2V5cyxcbiAgICAgICAgICAgIGtleSxcbiAgICAgICAgICAgIGksXG4gICAgICAgICAgICBtb2RpZmllcnMgPSBbXTtcblxuICAgICAgICAvLyB0YWtlIHRoZSBrZXlzIGZyb20gdGhpcyBwYXR0ZXJuIGFuZCBmaWd1cmUgb3V0IHdoYXQgdGhlIGFjdHVhbFxuICAgICAgICAvLyBwYXR0ZXJuIGlzIGFsbCBhYm91dFxuICAgICAgICBrZXlzID0gX2tleXNGcm9tU3RyaW5nKGNvbWJpbmF0aW9uKTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAga2V5ID0ga2V5c1tpXTtcblxuICAgICAgICAgICAgLy8gbm9ybWFsaXplIGtleSBuYW1lc1xuICAgICAgICAgICAgaWYgKF9TUEVDSUFMX0FMSUFTRVNba2V5XSkge1xuICAgICAgICAgICAgICAgIGtleSA9IF9TUEVDSUFMX0FMSUFTRVNba2V5XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdGhpcyBpcyBub3QgYSBrZXlwcmVzcyBldmVudCB0aGVuIHdlIHNob3VsZFxuICAgICAgICAgICAgLy8gYmUgc21hcnQgYWJvdXQgdXNpbmcgc2hpZnQga2V5c1xuICAgICAgICAgICAgLy8gdGhpcyB3aWxsIG9ubHkgd29yayBmb3IgVVMga2V5Ym9hcmRzIGhvd2V2ZXJcbiAgICAgICAgICAgIGlmIChhY3Rpb24gJiYgYWN0aW9uICE9ICdrZXlwcmVzcycgJiYgX1NISUZUX01BUFtrZXldKSB7XG4gICAgICAgICAgICAgICAga2V5ID0gX1NISUZUX01BUFtrZXldO1xuICAgICAgICAgICAgICAgIG1vZGlmaWVycy5wdXNoKCdzaGlmdCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGtleSBpcyBhIG1vZGlmaWVyIHRoZW4gYWRkIGl0IHRvIHRoZSBsaXN0IG9mIG1vZGlmaWVyc1xuICAgICAgICAgICAgaWYgKF9pc01vZGlmaWVyKGtleSkpIHtcbiAgICAgICAgICAgICAgICBtb2RpZmllcnMucHVzaChrZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVwZW5kaW5nIG9uIHdoYXQgdGhlIGtleSBjb21iaW5hdGlvbiBpc1xuICAgICAgICAvLyB3ZSB3aWxsIHRyeSB0byBwaWNrIHRoZSBiZXN0IGV2ZW50IGZvciBpdFxuICAgICAgICBhY3Rpb24gPSBfcGlja0Jlc3RBY3Rpb24oa2V5LCBtb2RpZmllcnMsIGFjdGlvbik7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgICAgbW9kaWZpZXJzOiBtb2RpZmllcnMsXG4gICAgICAgICAgICBhY3Rpb246IGFjdGlvblxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGJpbmRzIGEgc2luZ2xlIGtleWJvYXJkIGNvbWJpbmF0aW9uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29tYmluYXRpb25cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgICAqIEBwYXJhbSB7c3RyaW5nPX0gYWN0aW9uXG4gICAgICogQHBhcmFtIHtzdHJpbmc9fSBzZXF1ZW5jZU5hbWUgLSBuYW1lIG9mIHNlcXVlbmNlIGlmIHBhcnQgb2Ygc2VxdWVuY2VcbiAgICAgKiBAcGFyYW0ge251bWJlcj19IGxldmVsIC0gd2hhdCBwYXJ0IG9mIHRoZSBzZXF1ZW5jZSB0aGUgY29tbWFuZCBpc1xuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfYmluZFNpbmdsZShjb21iaW5hdGlvbiwgY2FsbGJhY2ssIGFjdGlvbiwgc2VxdWVuY2VOYW1lLCBsZXZlbCkge1xuXG4gICAgICAgIC8vIHN0b3JlIGEgZGlyZWN0IG1hcHBlZCByZWZlcmVuY2UgZm9yIHVzZSB3aXRoIE1vdXNldHJhcC50cmlnZ2VyXG4gICAgICAgIF9kaXJlY3RNYXBbY29tYmluYXRpb24gKyAnOicgKyBhY3Rpb25dID0gY2FsbGJhY2s7XG5cbiAgICAgICAgLy8gbWFrZSBzdXJlIG11bHRpcGxlIHNwYWNlcyBpbiBhIHJvdyBiZWNvbWUgYSBzaW5nbGUgc3BhY2VcbiAgICAgICAgY29tYmluYXRpb24gPSBjb21iaW5hdGlvbi5yZXBsYWNlKC9cXHMrL2csICcgJyk7XG5cbiAgICAgICAgdmFyIHNlcXVlbmNlID0gY29tYmluYXRpb24uc3BsaXQoJyAnKSxcbiAgICAgICAgICAgIGluZm87XG5cbiAgICAgICAgLy8gaWYgdGhpcyBwYXR0ZXJuIGlzIGEgc2VxdWVuY2Ugb2Yga2V5cyB0aGVuIHJ1biB0aHJvdWdoIHRoaXMgbWV0aG9kXG4gICAgICAgIC8vIHRvIHJlcHJvY2VzcyBlYWNoIHBhdHRlcm4gb25lIGtleSBhdCBhIHRpbWVcbiAgICAgICAgaWYgKHNlcXVlbmNlLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIF9iaW5kU2VxdWVuY2UoY29tYmluYXRpb24sIHNlcXVlbmNlLCBjYWxsYmFjaywgYWN0aW9uKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGluZm8gPSBfZ2V0S2V5SW5mbyhjb21iaW5hdGlvbiwgYWN0aW9uKTtcblxuICAgICAgICAvLyBtYWtlIHN1cmUgdG8gaW5pdGlhbGl6ZSBhcnJheSBpZiB0aGlzIGlzIHRoZSBmaXJzdCB0aW1lXG4gICAgICAgIC8vIGEgY2FsbGJhY2sgaXMgYWRkZWQgZm9yIHRoaXMga2V5XG4gICAgICAgIF9jYWxsYmFja3NbaW5mby5rZXldID0gX2NhbGxiYWNrc1tpbmZvLmtleV0gfHwgW107XG5cbiAgICAgICAgLy8gcmVtb3ZlIGFuIGV4aXN0aW5nIG1hdGNoIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgICBfZ2V0TWF0Y2hlcyhpbmZvLmtleSwgaW5mby5tb2RpZmllcnMsIHt0eXBlOiBpbmZvLmFjdGlvbn0sIHNlcXVlbmNlTmFtZSwgY29tYmluYXRpb24sIGxldmVsKTtcblxuICAgICAgICAvLyBhZGQgdGhpcyBjYWxsIGJhY2sgdG8gdGhlIGFycmF5XG4gICAgICAgIC8vIGlmIGl0IGlzIGEgc2VxdWVuY2UgcHV0IGl0IGF0IHRoZSBiZWdpbm5pbmdcbiAgICAgICAgLy8gaWYgbm90IHB1dCBpdCBhdCB0aGUgZW5kXG4gICAgICAgIC8vXG4gICAgICAgIC8vIHRoaXMgaXMgaW1wb3J0YW50IGJlY2F1c2UgdGhlIHdheSB0aGVzZSBhcmUgcHJvY2Vzc2VkIGV4cGVjdHNcbiAgICAgICAgLy8gdGhlIHNlcXVlbmNlIG9uZXMgdG8gY29tZSBmaXJzdFxuICAgICAgICBfY2FsbGJhY2tzW2luZm8ua2V5XVtzZXF1ZW5jZU5hbWUgPyAndW5zaGlmdCcgOiAncHVzaCddKHtcbiAgICAgICAgICAgIGNhbGxiYWNrOiBjYWxsYmFjayxcbiAgICAgICAgICAgIG1vZGlmaWVyczogaW5mby5tb2RpZmllcnMsXG4gICAgICAgICAgICBhY3Rpb246IGluZm8uYWN0aW9uLFxuICAgICAgICAgICAgc2VxOiBzZXF1ZW5jZU5hbWUsXG4gICAgICAgICAgICBsZXZlbDogbGV2ZWwsXG4gICAgICAgICAgICBjb21ibzogY29tYmluYXRpb25cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYmluZHMgbXVsdGlwbGUgY29tYmluYXRpb25zIHRvIHRoZSBzYW1lIGNhbGxiYWNrXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBjb21iaW5hdGlvbnNcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgICAqIEBwYXJhbSB7c3RyaW5nfHVuZGVmaW5lZH0gYWN0aW9uXG4gICAgICogQHJldHVybnMgdm9pZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9iaW5kTXVsdGlwbGUoY29tYmluYXRpb25zLCBjYWxsYmFjaywgYWN0aW9uKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29tYmluYXRpb25zLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBfYmluZFNpbmdsZShjb21iaW5hdGlvbnNbaV0sIGNhbGxiYWNrLCBhY3Rpb24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc3RhcnQhXG4gICAgX2FkZEV2ZW50KGRvY3VtZW50LCAna2V5cHJlc3MnLCBfaGFuZGxlS2V5RXZlbnQpO1xuICAgIF9hZGRFdmVudChkb2N1bWVudCwgJ2tleWRvd24nLCBfaGFuZGxlS2V5RXZlbnQpO1xuICAgIF9hZGRFdmVudChkb2N1bWVudCwgJ2tleXVwJywgX2hhbmRsZUtleUV2ZW50KTtcblxuICAgIHZhciBNb3VzZXRyYXAgPSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGJpbmRzIGFuIGV2ZW50IHRvIG1vdXNldHJhcFxuICAgICAgICAgKlxuICAgICAgICAgKiBjYW4gYmUgYSBzaW5nbGUga2V5LCBhIGNvbWJpbmF0aW9uIG9mIGtleXMgc2VwYXJhdGVkIHdpdGggKyxcbiAgICAgICAgICogYW4gYXJyYXkgb2Yga2V5cywgb3IgYSBzZXF1ZW5jZSBvZiBrZXlzIHNlcGFyYXRlZCBieSBzcGFjZXNcbiAgICAgICAgICpcbiAgICAgICAgICogYmUgc3VyZSB0byBsaXN0IHRoZSBtb2RpZmllciBrZXlzIGZpcnN0IHRvIG1ha2Ugc3VyZSB0aGF0IHRoZVxuICAgICAgICAgKiBjb3JyZWN0IGtleSBlbmRzIHVwIGdldHRpbmcgYm91bmQgKHRoZSBsYXN0IGtleSBpbiB0aGUgcGF0dGVybilcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd8QXJyYXl9IGtleXNcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmc9fSBhY3Rpb24gLSAna2V5cHJlc3MnLCAna2V5ZG93bicsIG9yICdrZXl1cCdcbiAgICAgICAgICogQHJldHVybnMgdm9pZFxuICAgICAgICAgKi9cbiAgICAgICAgYmluZDogZnVuY3Rpb24oa2V5cywgY2FsbGJhY2ssIGFjdGlvbikge1xuICAgICAgICAgICAga2V5cyA9IGtleXMgaW5zdGFuY2VvZiBBcnJheSA/IGtleXMgOiBba2V5c107XG4gICAgICAgICAgICBfYmluZE11bHRpcGxlKGtleXMsIGNhbGxiYWNrLCBhY3Rpb24pO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHVuYmluZHMgYW4gZXZlbnQgdG8gbW91c2V0cmFwXG4gICAgICAgICAqXG4gICAgICAgICAqIHRoZSB1bmJpbmRpbmcgc2V0cyB0aGUgY2FsbGJhY2sgZnVuY3Rpb24gb2YgdGhlIHNwZWNpZmllZCBrZXkgY29tYm9cbiAgICAgICAgICogdG8gYW4gZW1wdHkgZnVuY3Rpb24gYW5kIGRlbGV0ZXMgdGhlIGNvcnJlc3BvbmRpbmcga2V5IGluIHRoZVxuICAgICAgICAgKiBfZGlyZWN0TWFwIGRpY3QuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRPRE86IGFjdHVhbGx5IHJlbW92ZSB0aGlzIGZyb20gdGhlIF9jYWxsYmFja3MgZGljdGlvbmFyeSBpbnN0ZWFkXG4gICAgICAgICAqIG9mIGJpbmRpbmcgYW4gZW1wdHkgZnVuY3Rpb25cbiAgICAgICAgICpcbiAgICAgICAgICogdGhlIGtleWNvbWJvK2FjdGlvbiBoYXMgdG8gYmUgZXhhY3RseSB0aGUgc2FtZSBhc1xuICAgICAgICAgKiBpdCB3YXMgZGVmaW5lZCBpbiB0aGUgYmluZCBtZXRob2RcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd8QXJyYXl9IGtleXNcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGFjdGlvblxuICAgICAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICAgICAqL1xuICAgICAgICB1bmJpbmQ6IGZ1bmN0aW9uKGtleXMsIGFjdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIE1vdXNldHJhcC5iaW5kKGtleXMsIGZ1bmN0aW9uKCkge30sIGFjdGlvbik7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHRyaWdnZXJzIGFuIGV2ZW50IHRoYXQgaGFzIGFscmVhZHkgYmVlbiBib3VuZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5c1xuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZz19IGFjdGlvblxuICAgICAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICAgICAqL1xuICAgICAgICB0cmlnZ2VyOiBmdW5jdGlvbihrZXlzLCBhY3Rpb24pIHtcbiAgICAgICAgICAgIGlmIChfZGlyZWN0TWFwW2tleXMgKyAnOicgKyBhY3Rpb25dKSB7XG4gICAgICAgICAgICAgICAgX2RpcmVjdE1hcFtrZXlzICsgJzonICsgYWN0aW9uXSh7fSwga2V5cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogcmVzZXRzIHRoZSBsaWJyYXJ5IGJhY2sgdG8gaXRzIGluaXRpYWwgc3RhdGUuICB0aGlzIGlzIHVzZWZ1bFxuICAgICAgICAgKiBpZiB5b3Ugd2FudCB0byBjbGVhciBvdXQgdGhlIGN1cnJlbnQga2V5Ym9hcmQgc2hvcnRjdXRzIGFuZCBiaW5kXG4gICAgICAgICAqIG5ldyBvbmVzIC0gZm9yIGV4YW1wbGUgaWYgeW91IHN3aXRjaCB0byBhbm90aGVyIHBhZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMgdm9pZFxuICAgICAgICAgKi9cbiAgICAgICAgcmVzZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgX2NhbGxiYWNrcyA9IHt9O1xuICAgICAgICAgICAgX2RpcmVjdE1hcCA9IHt9O1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAvKipcbiAgICAgICAgKiBzaG91bGQgd2Ugc3RvcCB0aGlzIGV2ZW50IGJlZm9yZSBmaXJpbmcgb2ZmIGNhbGxiYWNrc1xuICAgICAgICAqXG4gICAgICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAgICAqIEBwYXJhbSB7RWxlbWVudH0gZWxlbWVudFxuICAgICAgICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAgICAgICovXG4gICAgICAgIHN0b3BDYWxsYmFjazogZnVuY3Rpb24oZSwgZWxlbWVudCkge1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgZWxlbWVudCBoYXMgdGhlIGNsYXNzIFwibW91c2V0cmFwXCIgdGhlbiBubyBuZWVkIHRvIHN0b3BcbiAgICAgICAgICAgIGlmICgoJyAnICsgZWxlbWVudC5jbGFzc05hbWUgKyAnICcpLmluZGV4T2YoJyBtb3VzZXRyYXAgJykgPiAtMSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc3RvcCBmb3IgaW5wdXQsIHNlbGVjdCwgYW5kIHRleHRhcmVhXG4gICAgICAgICAgICByZXR1cm4gZWxlbWVudC50YWdOYW1lID09ICdJTlBVVCcgfHwgZWxlbWVudC50YWdOYW1lID09ICdTRUxFQ1QnIHx8IGVsZW1lbnQudGFnTmFtZSA9PSAnVEVYVEFSRUEnIHx8IGVsZW1lbnQuaXNDb250ZW50RWRpdGFibGU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGV4cG9zZXMgX2hhbmRsZUtleSBwdWJsaWNseSBzbyBpdCBjYW4gYmUgb3ZlcndyaXR0ZW4gYnkgZXh0ZW5zaW9uc1xuICAgICAgICAgKi9cbiAgICAgICAgaGFuZGxlS2V5OiBfaGFuZGxlS2V5XG4gICAgfTtcblxuICAgIC8vIGV4cG9zZSBtb3VzZXRyYXAgdG8gdGhlIGdsb2JhbCBvYmplY3RcbiAgICB3aW5kb3cuTW91c2V0cmFwID0gTW91c2V0cmFwO1xuXG4gICAgLy8gZXhwb3NlIG1vdXNldHJhcCBhcyBhbiBBTUQgbW9kdWxlXG4gICAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgICBkZWZpbmUoTW91c2V0cmFwKTtcbiAgICB9XG59KSAod2luZG93LCBkb2N1bWVudCk7XG4iLCIvKiEgYW5ndWxhcmpzLXNsaWRlciAtIHY1LjguNyAtIFxuIChjKSBSYWZhbCBaYWphYyA8cnphamFjQGdtYWlsLmNvbT4sIFZhbGVudGluIEhlcnZpZXUgPHZhbGVudGluQGhlcnZpZXUubWU+LCBKdXNzaSBTYWFyaXZpcnRhIDxqdXNhc2lAZ21haWwuY29tPiwgQW5nZWxpbiBTaXJidSA8YW5nZWxpbi5zaXJidUBnbWFpbC5jb20+IC0gXG4gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXItc2xpZGVyL2FuZ3VsYXJqcy1zbGlkZXIgLSBcbiAyMDE2LTExLTA5ICovXG4vKmpzbGludCB1bnBhcmFtOiB0cnVlICovXG4vKmdsb2JhbCBhbmd1bGFyOiBmYWxzZSwgY29uc29sZTogZmFsc2UsIGRlZmluZSwgbW9kdWxlICovXG4oZnVuY3Rpb24ocm9vdCwgZmFjdG9yeSkge1xuICAndXNlIHN0cmljdCc7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAvLyBBTUQuIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBtb2R1bGUuXG4gICAgZGVmaW5lKFsnYW5ndWxhciddLCBmYWN0b3J5KTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgIC8vIE5vZGUuIERvZXMgbm90IHdvcmsgd2l0aCBzdHJpY3QgQ29tbW9uSlMsIGJ1dFxuICAgIC8vIG9ubHkgQ29tbW9uSlMtbGlrZSBlbnZpcm9ubWVudHMgdGhhdCBzdXBwb3J0IG1vZHVsZS5leHBvcnRzLFxuICAgIC8vIGxpa2UgTm9kZS5cbiAgICAvLyB0byBzdXBwb3J0IGJ1bmRsZXIgbGlrZSBicm93c2VyaWZ5XG4gICAgdmFyIGFuZ3VsYXJPYmogPSByZXF1aXJlKCdhbmd1bGFyJyk7XG4gICAgaWYgKCghYW5ndWxhck9iaiB8fCAhYW5ndWxhck9iai5tb2R1bGUpICYmIHR5cGVvZiBhbmd1bGFyICE9ICd1bmRlZmluZWQnKSB7XG4gICAgICBhbmd1bGFyT2JqID0gYW5ndWxhcjtcbiAgICB9XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KGFuZ3VsYXJPYmopO1xuICB9IGVsc2Uge1xuICAgIC8vIEJyb3dzZXIgZ2xvYmFscyAocm9vdCBpcyB3aW5kb3cpXG4gICAgZmFjdG9yeShyb290LmFuZ3VsYXIpO1xuICB9XG5cbn0odGhpcywgZnVuY3Rpb24oYW5ndWxhcikge1xuICAndXNlIHN0cmljdCc7XG4gIHZhciBtb2R1bGUgPSBhbmd1bGFyLm1vZHVsZSgncnpNb2R1bGUnLCBbXSlcblxuICAuZmFjdG9yeSgnUnpTbGlkZXJPcHRpb25zJywgZnVuY3Rpb24oKSB7XG4gICAgdmFyIGRlZmF1bHRPcHRpb25zID0ge1xuICAgICAgZmxvb3I6IDAsXG4gICAgICBjZWlsOiBudWxsLCAvL2RlZmF1bHRzIHRvIHJ6LXNsaWRlci1tb2RlbFxuICAgICAgc3RlcDogMSxcbiAgICAgIHByZWNpc2lvbjogMCxcbiAgICAgIG1pblJhbmdlOiBudWxsLFxuICAgICAgbWF4UmFuZ2U6IG51bGwsXG4gICAgICBwdXNoUmFuZ2U6IGZhbHNlLFxuICAgICAgbWluTGltaXQ6IG51bGwsXG4gICAgICBtYXhMaW1pdDogbnVsbCxcbiAgICAgIGlkOiBudWxsLFxuICAgICAgdHJhbnNsYXRlOiBudWxsLFxuICAgICAgZ2V0TGVnZW5kOiBudWxsLFxuICAgICAgc3RlcHNBcnJheTogbnVsbCxcbiAgICAgIGJpbmRJbmRleEZvclN0ZXBzQXJyYXk6IGZhbHNlLFxuICAgICAgZHJhZ2dhYmxlUmFuZ2U6IGZhbHNlLFxuICAgICAgZHJhZ2dhYmxlUmFuZ2VPbmx5OiBmYWxzZSxcbiAgICAgIHNob3dTZWxlY3Rpb25CYXI6IGZhbHNlLFxuICAgICAgc2hvd1NlbGVjdGlvbkJhckVuZDogZmFsc2UsXG4gICAgICBzaG93U2VsZWN0aW9uQmFyRnJvbVZhbHVlOiBudWxsLFxuICAgICAgaGlkZVBvaW50ZXJMYWJlbHM6IGZhbHNlLFxuICAgICAgaGlkZUxpbWl0TGFiZWxzOiBmYWxzZSxcbiAgICAgIGF1dG9IaWRlTGltaXRMYWJlbHM6IHRydWUsXG4gICAgICByZWFkT25seTogZmFsc2UsXG4gICAgICBkaXNhYmxlZDogZmFsc2UsXG4gICAgICBpbnRlcnZhbDogMzUwLFxuICAgICAgc2hvd1RpY2tzOiBmYWxzZSxcbiAgICAgIHNob3dUaWNrc1ZhbHVlczogZmFsc2UsXG4gICAgICB0aWNrc0FycmF5OiBudWxsLFxuICAgICAgdGlja3NUb29sdGlwOiBudWxsLFxuICAgICAgdGlja3NWYWx1ZXNUb29sdGlwOiBudWxsLFxuICAgICAgdmVydGljYWw6IGZhbHNlLFxuICAgICAgZ2V0U2VsZWN0aW9uQmFyQ29sb3I6IG51bGwsXG4gICAgICBnZXRUaWNrQ29sb3I6IG51bGwsXG4gICAgICBnZXRQb2ludGVyQ29sb3I6IG51bGwsXG4gICAgICBrZXlib2FyZFN1cHBvcnQ6IHRydWUsXG4gICAgICBzY2FsZTogMSxcbiAgICAgIGVuZm9yY2VTdGVwOiB0cnVlLFxuICAgICAgZW5mb3JjZVJhbmdlOiBmYWxzZSxcbiAgICAgIG5vU3dpdGNoaW5nOiBmYWxzZSxcbiAgICAgIG9ubHlCaW5kSGFuZGxlczogZmFsc2UsXG4gICAgICBvblN0YXJ0OiBudWxsLFxuICAgICAgb25DaGFuZ2U6IG51bGwsXG4gICAgICBvbkVuZDogbnVsbCxcbiAgICAgIHJpZ2h0VG9MZWZ0OiBmYWxzZSxcbiAgICAgIGJvdW5kUG9pbnRlckxhYmVsczogdHJ1ZSxcbiAgICAgIG1lcmdlUmFuZ2VMYWJlbHNJZlNhbWU6IGZhbHNlLFxuICAgICAgY3VzdG9tVGVtcGxhdGVTY29wZTogbnVsbCxcbiAgICAgIGxvZ1NjYWxlOiBmYWxzZSxcbiAgICAgIGN1c3RvbVZhbHVlVG9Qb3NpdGlvbjogbnVsbCxcbiAgICAgIGN1c3RvbVBvc2l0aW9uVG9WYWx1ZTogbnVsbFxuICAgIH07XG4gICAgdmFyIGdsb2JhbE9wdGlvbnMgPSB7fTtcblxuICAgIHZhciBmYWN0b3J5ID0ge307XG4gICAgLyoqXG4gICAgICogYG9wdGlvbnMoe30pYCBhbGxvd3MgZ2xvYmFsIGNvbmZpZ3VyYXRpb24gb2YgYWxsIHNsaWRlcnMgaW4gdGhlXG4gICAgICogYXBwbGljYXRpb24uXG4gICAgICpcbiAgICAgKiAgIHZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSggJ0FwcCcsIFsncnpNb2R1bGUnXSwgZnVuY3Rpb24oIFJ6U2xpZGVyT3B0aW9ucyApIHtcbiAgICAgKiAgICAgLy8gc2hvdyB0aWNrcyBmb3IgYWxsIHNsaWRlcnNcbiAgICAgKiAgICAgUnpTbGlkZXJPcHRpb25zLm9wdGlvbnMoIHsgc2hvd1RpY2tzOiB0cnVlIH0gKTtcbiAgICAgKiAgIH0pO1xuICAgICAqL1xuICAgIGZhY3Rvcnkub3B0aW9ucyA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICBhbmd1bGFyLmV4dGVuZChnbG9iYWxPcHRpb25zLCB2YWx1ZSk7XG4gICAgfTtcblxuICAgIGZhY3RvcnkuZ2V0T3B0aW9ucyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgIHJldHVybiBhbmd1bGFyLmV4dGVuZCh7fSwgZGVmYXVsdE9wdGlvbnMsIGdsb2JhbE9wdGlvbnMsIG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICByZXR1cm4gZmFjdG9yeTtcbiAgfSlcblxuICAuZmFjdG9yeSgncnpUaHJvdHRsZScsIFsnJHRpbWVvdXQnLCBmdW5jdGlvbigkdGltZW91dCkge1xuICAgIC8qKlxuICAgICAqIHJ6VGhyb3R0bGVcbiAgICAgKlxuICAgICAqIFRha2VuIGZyb20gdW5kZXJzY29yZSBwcm9qZWN0XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdhaXRcbiAgICAgKiBAcGFyYW0ge1Rocm90dGxlT3B0aW9uc30gb3B0aW9uc1xuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAgICAgKi9cbiAgICByZXR1cm4gZnVuY3Rpb24oZnVuYywgd2FpdCwgb3B0aW9ucykge1xuICAgICAgJ3VzZSBzdHJpY3QnO1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgIHZhciBnZXRUaW1lID0gKERhdGUubm93IHx8IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICB9KTtcbiAgICAgIHZhciBjb250ZXh0LCBhcmdzLCByZXN1bHQ7XG4gICAgICB2YXIgdGltZW91dCA9IG51bGw7XG4gICAgICB2YXIgcHJldmlvdXMgPSAwO1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICB2YXIgbGF0ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcHJldmlvdXMgPSBnZXRUaW1lKCk7XG4gICAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgICB9O1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbm93ID0gZ2V0VGltZSgpO1xuICAgICAgICB2YXIgcmVtYWluaW5nID0gd2FpdCAtIChub3cgLSBwcmV2aW91cyk7XG4gICAgICAgIGNvbnRleHQgPSB0aGlzO1xuICAgICAgICBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgICBpZiAocmVtYWluaW5nIDw9IDApIHtcbiAgICAgICAgICAkdGltZW91dC5jYW5jZWwodGltZW91dCk7XG4gICAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgICAgcHJldmlvdXMgPSBub3c7XG4gICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgICBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgICAgIH0gZWxzZSBpZiAoIXRpbWVvdXQgJiYgb3B0aW9ucy50cmFpbGluZyAhPT0gZmFsc2UpIHtcbiAgICAgICAgICB0aW1lb3V0ID0gJHRpbWVvdXQobGF0ZXIsIHJlbWFpbmluZyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH07XG4gICAgfVxuICB9XSlcblxuICAuZmFjdG9yeSgnUnpTbGlkZXInLCBbJyR0aW1lb3V0JywgJyRkb2N1bWVudCcsICckd2luZG93JywgJyRjb21waWxlJywgJ1J6U2xpZGVyT3B0aW9ucycsICdyelRocm90dGxlJywgZnVuY3Rpb24oJHRpbWVvdXQsICRkb2N1bWVudCwgJHdpbmRvdywgJGNvbXBpbGUsIFJ6U2xpZGVyT3B0aW9ucywgcnpUaHJvdHRsZSkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIC8qKlxuICAgICAqIFNsaWRlclxuICAgICAqXG4gICAgICogQHBhcmFtIHtuZ1Njb3BlfSBzY29wZSAgICAgICAgICAgIFRoZSBBbmd1bGFySlMgc2NvcGVcbiAgICAgKiBAcGFyYW0ge0VsZW1lbnR9IHNsaWRlckVsZW0gVGhlIHNsaWRlciBkaXJlY3RpdmUgZWxlbWVudCB3cmFwcGVkIGluIGpxTGl0ZVxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIHZhciBTbGlkZXIgPSBmdW5jdGlvbihzY29wZSwgc2xpZGVyRWxlbSkge1xuICAgICAgLyoqXG4gICAgICAgKiBUaGUgc2xpZGVyJ3Mgc2NvcGVcbiAgICAgICAqXG4gICAgICAgKiBAdHlwZSB7bmdTY29wZX1cbiAgICAgICAqL1xuICAgICAgdGhpcy5zY29wZSA9IHNjb3BlO1xuXG4gICAgICAvKipcbiAgICAgICAqIFRoZSBzbGlkZXIgaW5uZXIgbG93IHZhbHVlIChsaW5rZWQgdG8gcnpTbGlkZXJNb2RlbClcbiAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIHRoaXMubG93VmFsdWUgPSAwO1xuXG4gICAgICAvKipcbiAgICAgICAqIFRoZSBzbGlkZXIgaW5uZXIgaGlnaCB2YWx1ZSAobGlua2VkIHRvIHJ6U2xpZGVySGlnaClcbiAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIHRoaXMuaGlnaFZhbHVlID0gMDtcblxuICAgICAgLyoqXG4gICAgICAgKiBTbGlkZXIgZWxlbWVudCB3cmFwcGVkIGluIGpxTGl0ZVxuICAgICAgICpcbiAgICAgICAqIEB0eXBlIHtqcUxpdGV9XG4gICAgICAgKi9cbiAgICAgIHRoaXMuc2xpZGVyRWxlbSA9IHNsaWRlckVsZW07XG5cbiAgICAgIC8qKlxuICAgICAgICogU2xpZGVyIHR5cGVcbiAgICAgICAqXG4gICAgICAgKiBAdHlwZSB7Ym9vbGVhbn0gU2V0IHRvIHRydWUgZm9yIHJhbmdlIHNsaWRlclxuICAgICAgICovXG4gICAgICB0aGlzLnJhbmdlID0gdGhpcy5zY29wZS5yelNsaWRlck1vZGVsICE9PSB1bmRlZmluZWQgJiYgdGhpcy5zY29wZS5yelNsaWRlckhpZ2ggIT09IHVuZGVmaW5lZDtcblxuICAgICAgLyoqXG4gICAgICAgKiBWYWx1ZXMgcmVjb3JkZWQgd2hlbiBmaXJzdCBkcmFnZ2luZyB0aGUgYmFyXG4gICAgICAgKlxuICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAqL1xuICAgICAgdGhpcy5kcmFnZ2luZyA9IHtcbiAgICAgICAgYWN0aXZlOiBmYWxzZSxcbiAgICAgICAgdmFsdWU6IDAsXG4gICAgICAgIGRpZmZlcmVuY2U6IDAsXG4gICAgICAgIHBvc2l0aW9uOiAwLFxuICAgICAgICBsb3dMaW1pdDogMCxcbiAgICAgICAgaGlnaExpbWl0OiAwXG4gICAgICB9O1xuXG4gICAgICAvKipcbiAgICAgICAqIHByb3BlcnR5IHRoYXQgaGFuZGxlIHBvc2l0aW9uIChkZWZhdWx0cyB0byBsZWZ0IGZvciBob3Jpem9udGFsKVxuICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAqL1xuICAgICAgdGhpcy5wb3NpdGlvblByb3BlcnR5ID0gJ2xlZnQnO1xuXG4gICAgICAvKipcbiAgICAgICAqIHByb3BlcnR5IHRoYXQgaGFuZGxlIGRpbWVuc2lvbiAoZGVmYXVsdHMgdG8gd2lkdGggZm9yIGhvcml6b250YWwpXG4gICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICovXG4gICAgICB0aGlzLmRpbWVuc2lvblByb3BlcnR5ID0gJ3dpZHRoJztcblxuICAgICAgLyoqXG4gICAgICAgKiBIYWxmIG9mIHRoZSB3aWR0aCBvciBoZWlnaHQgb2YgdGhlIHNsaWRlciBoYW5kbGVzXG4gICAgICAgKlxuICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAqL1xuICAgICAgdGhpcy5oYW5kbGVIYWxmRGltID0gMDtcblxuICAgICAgLyoqXG4gICAgICAgKiBNYXhpbXVtIHBvc2l0aW9uIHRoZSBzbGlkZXIgaGFuZGxlIGNhbiBoYXZlXG4gICAgICAgKlxuICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAqL1xuICAgICAgdGhpcy5tYXhQb3MgPSAwO1xuXG4gICAgICAvKipcbiAgICAgICAqIFByZWNpc2lvblxuICAgICAgICpcbiAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIHRoaXMucHJlY2lzaW9uID0gMDtcblxuICAgICAgLyoqXG4gICAgICAgKiBTdGVwXG4gICAgICAgKlxuICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAqL1xuICAgICAgdGhpcy5zdGVwID0gMTtcblxuICAgICAgLyoqXG4gICAgICAgKiBUaGUgbmFtZSBvZiB0aGUgaGFuZGxlIHdlIGFyZSBjdXJyZW50bHkgdHJhY2tpbmdcbiAgICAgICAqXG4gICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICovXG4gICAgICB0aGlzLnRyYWNraW5nID0gJyc7XG5cbiAgICAgIC8qKlxuICAgICAgICogTWluaW11bSB2YWx1ZSAoZmxvb3IpIG9mIHRoZSBtb2RlbFxuICAgICAgICpcbiAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIHRoaXMubWluVmFsdWUgPSAwO1xuXG4gICAgICAvKipcbiAgICAgICAqIE1heGltdW0gdmFsdWUgKGNlaWxpbmcpIG9mIHRoZSBtb2RlbFxuICAgICAgICpcbiAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIHRoaXMubWF4VmFsdWUgPSAwO1xuXG5cbiAgICAgIC8qKlxuICAgICAgICogVGhlIGRlbHRhIGJldHdlZW4gbWluIGFuZCBtYXggdmFsdWVcbiAgICAgICAqXG4gICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICovXG4gICAgICB0aGlzLnZhbHVlUmFuZ2UgPSAwO1xuXG5cbiAgICAgIC8qKlxuICAgICAgICogSWYgc2hvd1RpY2tzL3Nob3dUaWNrc1ZhbHVlcyBvcHRpb25zIGFyZSBudW1iZXIuXG4gICAgICAgKiBJbiB0aGlzIGNhc2UsIHRpY2tzIHZhbHVlcyBzaG91bGQgYmUgZGlzcGxheWVkIGJlbG93IHRoZSBzbGlkZXIuXG4gICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAqL1xuICAgICAgdGhpcy5pbnRlcm1lZGlhdGVUaWNrcyA9IGZhbHNlO1xuXG4gICAgICAvKipcbiAgICAgICAqIFNldCB0byB0cnVlIGlmIGluaXQgbWV0aG9kIGFscmVhZHkgZXhlY3V0ZWRcbiAgICAgICAqXG4gICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAqL1xuICAgICAgdGhpcy5pbml0SGFzUnVuID0gZmFsc2U7XG5cbiAgICAgIC8qKlxuICAgICAgICogVXNlZCB0byBjYWxsIG9uU3RhcnQgb24gdGhlIGZpcnN0IGtleWRvd24gZXZlbnRcbiAgICAgICAqXG4gICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAqL1xuICAgICAgdGhpcy5maXJzdEtleURvd24gPSBmYWxzZTtcblxuICAgICAgLyoqXG4gICAgICAgKiBJbnRlcm5hbCBmbGFnIHRvIHByZXZlbnQgd2F0Y2hlcnMgdG8gYmUgY2FsbGVkIHdoZW4gdGhlIHNsaWRlcnMgdmFsdWUgYXJlIG1vZGlmaWVkIGludGVybmFsbHkuXG4gICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAqL1xuICAgICAgdGhpcy5pbnRlcm5hbENoYW5nZSA9IGZhbHNlO1xuXG4gICAgICAvKipcbiAgICAgICAqIEludGVybmFsIGZsYWcgdG8ga2VlcCB0cmFjayBvZiB0aGUgdmlzaWJpbGl0eSBvZiBjb21ibyBsYWJlbFxuICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgKi9cbiAgICAgIHRoaXMuY21iTGFiZWxTaG93biA9IGZhbHNlO1xuXG4gICAgICAvKipcbiAgICAgICAqIEludGVybmFsIHZhcmlhYmxlIHRvIGtlZXAgdHJhY2sgb2YgdGhlIGZvY3VzIGVsZW1lbnRcbiAgICAgICAqL1xuICAgICAgdGhpcy5jdXJyZW50Rm9jdXNFbGVtZW50ID0gbnVsbDtcblxuICAgICAgLy8gU2xpZGVyIERPTSBlbGVtZW50cyB3cmFwcGVkIGluIGpxTGl0ZVxuICAgICAgdGhpcy5mdWxsQmFyID0gbnVsbDsgLy8gVGhlIHdob2xlIHNsaWRlciBiYXJcbiAgICAgIHRoaXMuc2VsQmFyID0gbnVsbDsgLy8gSGlnaGxpZ2h0IGJldHdlZW4gdHdvIGhhbmRsZXNcbiAgICAgIHRoaXMubWluSCA9IG51bGw7IC8vIExlZnQgc2xpZGVyIGhhbmRsZVxuICAgICAgdGhpcy5tYXhIID0gbnVsbDsgLy8gUmlnaHQgc2xpZGVyIGhhbmRsZVxuICAgICAgdGhpcy5mbHJMYWIgPSBudWxsOyAvLyBGbG9vciBsYWJlbFxuICAgICAgdGhpcy5jZWlsTGFiID0gbnVsbDsgLy8gQ2VpbGluZyBsYWJlbFxuICAgICAgdGhpcy5taW5MYWIgPSBudWxsOyAvLyBMYWJlbCBhYm92ZSB0aGUgbG93IHZhbHVlXG4gICAgICB0aGlzLm1heExhYiA9IG51bGw7IC8vIExhYmVsIGFib3ZlIHRoZSBoaWdoIHZhbHVlXG4gICAgICB0aGlzLmNtYkxhYiA9IG51bGw7IC8vIENvbWJpbmVkIGxhYmVsXG4gICAgICB0aGlzLnRpY2tzID0gbnVsbDsgLy8gVGhlIHRpY2tzXG5cbiAgICAgIC8vIEluaXRpYWxpemUgc2xpZGVyXG4gICAgICB0aGlzLmluaXQoKTtcbiAgICB9O1xuXG4gICAgLy8gQWRkIGluc3RhbmNlIG1ldGhvZHNcbiAgICBTbGlkZXIucHJvdG90eXBlID0ge1xuXG4gICAgICAvKipcbiAgICAgICAqIEluaXRpYWxpemUgc2xpZGVyXG4gICAgICAgKlxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB0aHJMb3csIHRockhpZ2gsXG4gICAgICAgICAgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdmFyIGNhbGNEaW1GbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHNlbGYuY2FsY1ZpZXdEaW1lbnNpb25zKCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5hcHBseU9wdGlvbnMoKTtcbiAgICAgICAgdGhpcy5zeW5jTG93VmFsdWUoKTtcbiAgICAgICAgaWYgKHRoaXMucmFuZ2UpXG4gICAgICAgICAgdGhpcy5zeW5jSGlnaFZhbHVlKCk7XG4gICAgICAgIHRoaXMuaW5pdEVsZW1IYW5kbGVzKCk7XG4gICAgICAgIHRoaXMubWFuYWdlRWxlbWVudHNTdHlsZSgpO1xuICAgICAgICB0aGlzLnNldERpc2FibGVkU3RhdGUoKTtcbiAgICAgICAgdGhpcy5jYWxjVmlld0RpbWVuc2lvbnMoKTtcbiAgICAgICAgdGhpcy5zZXRNaW5BbmRNYXgoKTtcbiAgICAgICAgdGhpcy5hZGRBY2Nlc3NpYmlsaXR5KCk7XG4gICAgICAgIHRoaXMudXBkYXRlQ2VpbExhYigpO1xuICAgICAgICB0aGlzLnVwZGF0ZUZsb29yTGFiKCk7XG4gICAgICAgIHRoaXMuaW5pdEhhbmRsZXMoKTtcbiAgICAgICAgdGhpcy5tYW5hZ2VFdmVudHNCaW5kaW5ncygpO1xuXG4gICAgICAgIC8vIFJlY2FsY3VsYXRlIHNsaWRlciB2aWV3IGRpbWVuc2lvbnNcbiAgICAgICAgdGhpcy5zY29wZS4kb24oJ3JlQ2FsY1ZpZXdEaW1lbnNpb25zJywgY2FsY0RpbUZuKTtcblxuICAgICAgICAvLyBSZWNhbGN1bGF0ZSBzdHVmZiBpZiB2aWV3IHBvcnQgZGltZW5zaW9ucyBoYXZlIGNoYW5nZWRcbiAgICAgICAgYW5ndWxhci5lbGVtZW50KCR3aW5kb3cpLm9uKCdyZXNpemUnLCBjYWxjRGltRm4pO1xuXG4gICAgICAgIHRoaXMuaW5pdEhhc1J1biA9IHRydWU7XG5cbiAgICAgICAgLy8gV2F0Y2ggZm9yIGNoYW5nZXMgdG8gdGhlIG1vZGVsXG4gICAgICAgIHRockxvdyA9IHJ6VGhyb3R0bGUoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgc2VsZi5vbkxvd0hhbmRsZUNoYW5nZSgpO1xuICAgICAgICB9LCBzZWxmLm9wdGlvbnMuaW50ZXJ2YWwpO1xuXG4gICAgICAgIHRockhpZ2ggPSByelRocm90dGxlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHNlbGYub25IaWdoSGFuZGxlQ2hhbmdlKCk7XG4gICAgICAgIH0sIHNlbGYub3B0aW9ucy5pbnRlcnZhbCk7XG5cbiAgICAgICAgdGhpcy5zY29wZS4kb24oJ3J6U2xpZGVyRm9yY2VSZW5kZXInLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBzZWxmLnJlc2V0TGFiZWxzVmFsdWUoKTtcbiAgICAgICAgICB0aHJMb3coKTtcbiAgICAgICAgICBpZiAoc2VsZi5yYW5nZSkge1xuICAgICAgICAgICAgdGhySGlnaCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzZWxmLnJlc2V0U2xpZGVyKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFdhdGNoZXJzIChvcmRlciBpcyBpbXBvcnRhbnQgYmVjYXVzZSBpbiBjYXNlIG9mIHNpbXVsdGFuZW91cyBjaGFuZ2UsXG4gICAgICAgIC8vIHdhdGNoZXJzIHdpbGwgYmUgY2FsbGVkIGluIHRoZSBzYW1lIG9yZGVyKVxuICAgICAgICB0aGlzLnNjb3BlLiR3YXRjaCgncnpTbGlkZXJPcHRpb25zKCknLCBmdW5jdGlvbihuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgICBpZiAobmV3VmFsdWUgPT09IG9sZFZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIHNlbGYuYXBwbHlPcHRpb25zKCk7IC8vIG5lZWQgdG8gYmUgY2FsbGVkIGJlZm9yZSBzeW5jaHJvbml6aW5nIHRoZSB2YWx1ZXNcbiAgICAgICAgICBzZWxmLnN5bmNMb3dWYWx1ZSgpO1xuICAgICAgICAgIGlmIChzZWxmLnJhbmdlKVxuICAgICAgICAgICAgc2VsZi5zeW5jSGlnaFZhbHVlKCk7XG4gICAgICAgICAgc2VsZi5yZXNldFNsaWRlcigpO1xuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICB0aGlzLnNjb3BlLiR3YXRjaCgncnpTbGlkZXJNb2RlbCcsIGZ1bmN0aW9uKG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICAgIGlmIChzZWxmLmludGVybmFsQ2hhbmdlKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIGlmIChuZXdWYWx1ZSA9PT0gb2xkVmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgdGhyTG93KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuc2NvcGUuJHdhdGNoKCdyelNsaWRlckhpZ2gnLCBmdW5jdGlvbihuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgICBpZiAoc2VsZi5pbnRlcm5hbENoYW5nZSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICBpZiAobmV3VmFsdWUgPT09IG9sZFZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIGlmIChuZXdWYWx1ZSAhPSBudWxsKVxuICAgICAgICAgICAgdGhySGlnaCgpO1xuICAgICAgICAgIGlmIChzZWxmLnJhbmdlICYmIG5ld1ZhbHVlID09IG51bGwgfHwgIXNlbGYucmFuZ2UgJiYgbmV3VmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgc2VsZi5hcHBseU9wdGlvbnMoKTtcbiAgICAgICAgICAgIHNlbGYucmVzZXRTbGlkZXIoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuc2NvcGUuJG9uKCckZGVzdHJveScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHNlbGYudW5iaW5kRXZlbnRzKCk7XG4gICAgICAgICAgYW5ndWxhci5lbGVtZW50KCR3aW5kb3cpLm9mZigncmVzaXplJywgY2FsY0RpbUZuKTtcbiAgICAgICAgICBzZWxmLmN1cnJlbnRGb2N1c0VsZW1lbnQgPSBudWxsO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG5cbiAgICAgIGZpbmRTdGVwSW5kZXg6IGZ1bmN0aW9uKG1vZGVsVmFsdWUpIHtcbiAgICAgICAgdmFyIGluZGV4ID0gMDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm9wdGlvbnMuc3RlcHNBcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHZhciBzdGVwID0gdGhpcy5vcHRpb25zLnN0ZXBzQXJyYXlbaV07XG4gICAgICAgICAgaWYgKHN0ZXAgPT09IG1vZGVsVmFsdWUpIHtcbiAgICAgICAgICAgIGluZGV4ID0gaTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIGlmIChhbmd1bGFyLmlzRGF0ZShzdGVwKSkge1xuICAgICAgICAgICAgaWYgKHN0ZXAuZ2V0VGltZSgpID09PSBtb2RlbFZhbHVlLmdldFRpbWUoKSkge1xuICAgICAgICAgICAgICBpbmRleCA9IGk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIGlmIChhbmd1bGFyLmlzT2JqZWN0KHN0ZXApKSB7XG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc0RhdGUoc3RlcC52YWx1ZSkgJiYgc3RlcC52YWx1ZS5nZXRUaW1lKCkgPT09IG1vZGVsVmFsdWUuZ2V0VGltZSgpIHx8IHN0ZXAudmFsdWUgPT09IG1vZGVsVmFsdWUpIHtcbiAgICAgICAgICAgICAgaW5kZXggPSBpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGluZGV4O1xuICAgICAgfSxcblxuICAgICAgc3luY0xvd1ZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5zdGVwc0FycmF5KSB7XG4gICAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMuYmluZEluZGV4Rm9yU3RlcHNBcnJheSlcbiAgICAgICAgICAgIHRoaXMubG93VmFsdWUgPSB0aGlzLmZpbmRTdGVwSW5kZXgodGhpcy5zY29wZS5yelNsaWRlck1vZGVsKTtcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aGlzLmxvd1ZhbHVlID0gdGhpcy5zY29wZS5yelNsaWRlck1vZGVsXG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRoaXMubG93VmFsdWUgPSB0aGlzLnNjb3BlLnJ6U2xpZGVyTW9kZWw7XG4gICAgICB9LFxuXG4gICAgICBzeW5jSGlnaFZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5zdGVwc0FycmF5KSB7XG4gICAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMuYmluZEluZGV4Rm9yU3RlcHNBcnJheSlcbiAgICAgICAgICAgIHRoaXMuaGlnaFZhbHVlID0gdGhpcy5maW5kU3RlcEluZGV4KHRoaXMuc2NvcGUucnpTbGlkZXJIaWdoKTtcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aGlzLmhpZ2hWYWx1ZSA9IHRoaXMuc2NvcGUucnpTbGlkZXJIaWdoXG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRoaXMuaGlnaFZhbHVlID0gdGhpcy5zY29wZS5yelNsaWRlckhpZ2g7XG4gICAgICB9LFxuXG4gICAgICBnZXRTdGVwVmFsdWU6IGZ1bmN0aW9uKHNsaWRlclZhbHVlKSB7XG4gICAgICAgIHZhciBzdGVwID0gdGhpcy5vcHRpb25zLnN0ZXBzQXJyYXlbc2xpZGVyVmFsdWVdO1xuICAgICAgICBpZiAoYW5ndWxhci5pc0RhdGUoc3RlcCkpXG4gICAgICAgICAgcmV0dXJuIHN0ZXA7XG4gICAgICAgIGlmIChhbmd1bGFyLmlzT2JqZWN0KHN0ZXApKVxuICAgICAgICAgIHJldHVybiBzdGVwLnZhbHVlO1xuICAgICAgICByZXR1cm4gc3RlcDtcbiAgICAgIH0sXG5cbiAgICAgIGFwcGx5TG93VmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnN0ZXBzQXJyYXkpIHtcbiAgICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5iaW5kSW5kZXhGb3JTdGVwc0FycmF5KVxuICAgICAgICAgICAgdGhpcy5zY29wZS5yelNsaWRlck1vZGVsID0gdGhpcy5nZXRTdGVwVmFsdWUodGhpcy5sb3dWYWx1ZSk7XG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhpcy5zY29wZS5yelNsaWRlck1vZGVsID0gdGhpcy5sb3dWYWx1ZVxuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aGlzLnNjb3BlLnJ6U2xpZGVyTW9kZWwgPSB0aGlzLmxvd1ZhbHVlO1xuICAgICAgfSxcblxuICAgICAgYXBwbHlIaWdoVmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnN0ZXBzQXJyYXkpIHtcbiAgICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5iaW5kSW5kZXhGb3JTdGVwc0FycmF5KVxuICAgICAgICAgICAgdGhpcy5zY29wZS5yelNsaWRlckhpZ2ggPSB0aGlzLmdldFN0ZXBWYWx1ZSh0aGlzLmhpZ2hWYWx1ZSk7XG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhpcy5zY29wZS5yelNsaWRlckhpZ2ggPSB0aGlzLmhpZ2hWYWx1ZVxuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aGlzLnNjb3BlLnJ6U2xpZGVySGlnaCA9IHRoaXMuaGlnaFZhbHVlO1xuICAgICAgfSxcblxuICAgICAgLypcbiAgICAgICAqIFJlZmxvdyB0aGUgc2xpZGVyIHdoZW4gdGhlIGxvdyBoYW5kbGUgY2hhbmdlcyAoY2FsbGVkIHdpdGggdGhyb3R0bGUpXG4gICAgICAgKi9cbiAgICAgIG9uTG93SGFuZGxlQ2hhbmdlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5zeW5jTG93VmFsdWUoKTtcbiAgICAgICAgaWYgKHRoaXMucmFuZ2UpXG4gICAgICAgICAgdGhpcy5zeW5jSGlnaFZhbHVlKCk7XG4gICAgICAgIHRoaXMuc2V0TWluQW5kTWF4KCk7XG4gICAgICAgIHRoaXMudXBkYXRlTG93SGFuZGxlKHRoaXMudmFsdWVUb1Bvc2l0aW9uKHRoaXMubG93VmFsdWUpKTtcbiAgICAgICAgdGhpcy51cGRhdGVTZWxlY3Rpb25CYXIoKTtcbiAgICAgICAgdGhpcy51cGRhdGVUaWNrc1NjYWxlKCk7XG4gICAgICAgIHRoaXMudXBkYXRlQXJpYUF0dHJpYnV0ZXMoKTtcbiAgICAgICAgaWYgKHRoaXMucmFuZ2UpIHtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUNtYkxhYmVsKCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIC8qXG4gICAgICAgKiBSZWZsb3cgdGhlIHNsaWRlciB3aGVuIHRoZSBoaWdoIGhhbmRsZSBjaGFuZ2VzIChjYWxsZWQgd2l0aCB0aHJvdHRsZSlcbiAgICAgICAqL1xuICAgICAgb25IaWdoSGFuZGxlQ2hhbmdlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5zeW5jTG93VmFsdWUoKTtcbiAgICAgICAgdGhpcy5zeW5jSGlnaFZhbHVlKCk7XG4gICAgICAgIHRoaXMuc2V0TWluQW5kTWF4KCk7XG4gICAgICAgIHRoaXMudXBkYXRlSGlnaEhhbmRsZSh0aGlzLnZhbHVlVG9Qb3NpdGlvbih0aGlzLmhpZ2hWYWx1ZSkpO1xuICAgICAgICB0aGlzLnVwZGF0ZVNlbGVjdGlvbkJhcigpO1xuICAgICAgICB0aGlzLnVwZGF0ZVRpY2tzU2NhbGUoKTtcbiAgICAgICAgdGhpcy51cGRhdGVDbWJMYWJlbCgpO1xuICAgICAgICB0aGlzLnVwZGF0ZUFyaWFBdHRyaWJ1dGVzKCk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFJlYWQgdGhlIHVzZXIgb3B0aW9ucyBhbmQgYXBwbHkgdGhlbSB0byB0aGUgc2xpZGVyIG1vZGVsXG4gICAgICAgKi9cbiAgICAgIGFwcGx5T3B0aW9uczogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzbGlkZXJPcHRpb25zO1xuICAgICAgICBpZiAodGhpcy5zY29wZS5yelNsaWRlck9wdGlvbnMpXG4gICAgICAgICAgc2xpZGVyT3B0aW9ucyA9IHRoaXMuc2NvcGUucnpTbGlkZXJPcHRpb25zKCk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBzbGlkZXJPcHRpb25zID0ge307XG5cbiAgICAgICAgdGhpcy5vcHRpb25zID0gUnpTbGlkZXJPcHRpb25zLmdldE9wdGlvbnMoc2xpZGVyT3B0aW9ucyk7XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5zdGVwIDw9IDApXG4gICAgICAgICAgdGhpcy5vcHRpb25zLnN0ZXAgPSAxO1xuXG4gICAgICAgIHRoaXMucmFuZ2UgPSB0aGlzLnNjb3BlLnJ6U2xpZGVyTW9kZWwgIT09IHVuZGVmaW5lZCAmJiB0aGlzLnNjb3BlLnJ6U2xpZGVySGlnaCAhPT0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLm9wdGlvbnMuZHJhZ2dhYmxlUmFuZ2UgPSB0aGlzLnJhbmdlICYmIHRoaXMub3B0aW9ucy5kcmFnZ2FibGVSYW5nZTtcbiAgICAgICAgdGhpcy5vcHRpb25zLmRyYWdnYWJsZVJhbmdlT25seSA9IHRoaXMucmFuZ2UgJiYgdGhpcy5vcHRpb25zLmRyYWdnYWJsZVJhbmdlT25seTtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5kcmFnZ2FibGVSYW5nZU9ubHkpIHtcbiAgICAgICAgICB0aGlzLm9wdGlvbnMuZHJhZ2dhYmxlUmFuZ2UgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5vcHRpb25zLnNob3dUaWNrcyA9IHRoaXMub3B0aW9ucy5zaG93VGlja3MgfHwgdGhpcy5vcHRpb25zLnNob3dUaWNrc1ZhbHVlcyB8fCAhIXRoaXMub3B0aW9ucy50aWNrc0FycmF5O1xuICAgICAgICB0aGlzLnNjb3BlLnNob3dUaWNrcyA9IHRoaXMub3B0aW9ucy5zaG93VGlja3M7IC8vc2NvcGUgaXMgdXNlZCBpbiB0aGUgdGVtcGxhdGVcbiAgICAgICAgaWYgKGFuZ3VsYXIuaXNOdW1iZXIodGhpcy5vcHRpb25zLnNob3dUaWNrcykgfHwgdGhpcy5vcHRpb25zLnRpY2tzQXJyYXkpXG4gICAgICAgICAgdGhpcy5pbnRlcm1lZGlhdGVUaWNrcyA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5vcHRpb25zLnNob3dTZWxlY3Rpb25CYXIgPSB0aGlzLm9wdGlvbnMuc2hvd1NlbGVjdGlvbkJhciB8fCB0aGlzLm9wdGlvbnMuc2hvd1NlbGVjdGlvbkJhckVuZFxuICAgICAgICAgIHx8IHRoaXMub3B0aW9ucy5zaG93U2VsZWN0aW9uQmFyRnJvbVZhbHVlICE9PSBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuc3RlcHNBcnJheSkge1xuICAgICAgICAgIHRoaXMucGFyc2VTdGVwc0FycmF5KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy50cmFuc2xhdGUpXG4gICAgICAgICAgICB0aGlzLmN1c3RvbVRyRm4gPSB0aGlzLm9wdGlvbnMudHJhbnNsYXRlO1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMuY3VzdG9tVHJGbiA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgICAgIHJldHVybiBTdHJpbmcodmFsdWUpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgIHRoaXMuZ2V0TGVnZW5kID0gdGhpcy5vcHRpb25zLmdldExlZ2VuZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMudmVydGljYWwpIHtcbiAgICAgICAgICB0aGlzLnBvc2l0aW9uUHJvcGVydHkgPSAnYm90dG9tJztcbiAgICAgICAgICB0aGlzLmRpbWVuc2lvblByb3BlcnR5ID0gJ2hlaWdodCc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmN1c3RvbVRlbXBsYXRlU2NvcGUpXG4gICAgICAgICAgdGhpcy5zY29wZS5jdXN0b20gPSB0aGlzLm9wdGlvbnMuY3VzdG9tVGVtcGxhdGVTY29wZTtcbiAgICAgIH0sXG5cbiAgICAgIHBhcnNlU3RlcHNBcnJheTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5mbG9vciA9IDA7XG4gICAgICAgIHRoaXMub3B0aW9ucy5jZWlsID0gdGhpcy5vcHRpb25zLnN0ZXBzQXJyYXkubGVuZ3RoIC0gMTtcbiAgICAgICAgdGhpcy5vcHRpb25zLnN0ZXAgPSAxO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMudHJhbnNsYXRlKSB7XG4gICAgICAgICAgdGhpcy5jdXN0b21UckZuID0gdGhpcy5vcHRpb25zLnRyYW5zbGF0ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0aGlzLmN1c3RvbVRyRm4gPSBmdW5jdGlvbihtb2RlbFZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLmJpbmRJbmRleEZvclN0ZXBzQXJyYXkpXG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLmdldFN0ZXBWYWx1ZShtb2RlbFZhbHVlKTtcbiAgICAgICAgICAgIHJldHVybiBtb2RlbFZhbHVlO1xuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmdldExlZ2VuZCA9IGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgICAgICAgdmFyIHN0ZXAgPSB0aGlzLm9wdGlvbnMuc3RlcHNBcnJheVtpbmRleF07XG4gICAgICAgICAgaWYgKGFuZ3VsYXIuaXNPYmplY3Qoc3RlcCkpXG4gICAgICAgICAgICByZXR1cm4gc3RlcC5sZWdlbmQ7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH07XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFJlc2V0cyBzbGlkZXJcbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgICAgICovXG4gICAgICByZXNldFNsaWRlcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMubWFuYWdlRWxlbWVudHNTdHlsZSgpO1xuICAgICAgICB0aGlzLmFkZEFjY2Vzc2liaWxpdHkoKTtcbiAgICAgICAgdGhpcy5zZXRNaW5BbmRNYXgoKTtcbiAgICAgICAgdGhpcy51cGRhdGVDZWlsTGFiKCk7XG4gICAgICAgIHRoaXMudXBkYXRlRmxvb3JMYWIoKTtcbiAgICAgICAgdGhpcy51bmJpbmRFdmVudHMoKTtcbiAgICAgICAgdGhpcy5tYW5hZ2VFdmVudHNCaW5kaW5ncygpO1xuICAgICAgICB0aGlzLnNldERpc2FibGVkU3RhdGUoKTtcbiAgICAgICAgdGhpcy5jYWxjVmlld0RpbWVuc2lvbnMoKTtcbiAgICAgICAgdGhpcy5yZWZvY3VzUG9pbnRlcklmTmVlZGVkKCk7XG4gICAgICB9LFxuXG4gICAgICByZWZvY3VzUG9pbnRlcklmTmVlZGVkOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuY3VycmVudEZvY3VzRWxlbWVudCkge1xuICAgICAgICAgIHRoaXMub25Qb2ludGVyRm9jdXModGhpcy5jdXJyZW50Rm9jdXNFbGVtZW50LnBvaW50ZXIsIHRoaXMuY3VycmVudEZvY3VzRWxlbWVudC5yZWYpO1xuICAgICAgICAgIHRoaXMuZm9jdXNFbGVtZW50KHRoaXMuY3VycmVudEZvY3VzRWxlbWVudC5wb2ludGVyKVxuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFNldCB0aGUgc2xpZGVyIGNoaWxkcmVuIHRvIHZhcmlhYmxlcyBmb3IgZWFzeSBhY2Nlc3NcbiAgICAgICAqXG4gICAgICAgKiBSdW4gb25seSBvbmNlIGR1cmluZyBpbml0aWFsaXphdGlvblxuICAgICAgICpcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIGluaXRFbGVtSGFuZGxlczogZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vIEFzc2lnbiBhbGwgc2xpZGVyIGVsZW1lbnRzIHRvIG9iamVjdCBwcm9wZXJ0aWVzIGZvciBlYXN5IGFjY2Vzc1xuICAgICAgICBhbmd1bGFyLmZvckVhY2godGhpcy5zbGlkZXJFbGVtLmNoaWxkcmVuKCksIGZ1bmN0aW9uKGVsZW0sIGluZGV4KSB7XG4gICAgICAgICAgdmFyIGpFbGVtID0gYW5ndWxhci5lbGVtZW50KGVsZW0pO1xuXG4gICAgICAgICAgc3dpdGNoIChpbmRleCkge1xuICAgICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgICB0aGlzLmZ1bGxCYXIgPSBqRWxlbTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgIHRoaXMuc2VsQmFyID0gakVsZW07XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgICB0aGlzLm1pbkggPSBqRWxlbTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICAgIHRoaXMubWF4SCA9IGpFbGVtO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgNDpcbiAgICAgICAgICAgICAgdGhpcy5mbHJMYWIgPSBqRWxlbTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDU6XG4gICAgICAgICAgICAgIHRoaXMuY2VpbExhYiA9IGpFbGVtO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgNjpcbiAgICAgICAgICAgICAgdGhpcy5taW5MYWIgPSBqRWxlbTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDc6XG4gICAgICAgICAgICAgIHRoaXMubWF4TGFiID0gakVsZW07XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSA4OlxuICAgICAgICAgICAgICB0aGlzLmNtYkxhYiA9IGpFbGVtO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgOTpcbiAgICAgICAgICAgICAgdGhpcy50aWNrcyA9IGpFbGVtO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgfSwgdGhpcyk7XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSBwb3NpdGlvbiBjYWNoZSBwcm9wZXJ0aWVzXG4gICAgICAgIHRoaXMuc2VsQmFyLnJ6c3AgPSAwO1xuICAgICAgICB0aGlzLm1pbkgucnpzcCA9IDA7XG4gICAgICAgIHRoaXMubWF4SC5yenNwID0gMDtcbiAgICAgICAgdGhpcy5mbHJMYWIucnpzcCA9IDA7XG4gICAgICAgIHRoaXMuY2VpbExhYi5yenNwID0gMDtcbiAgICAgICAgdGhpcy5taW5MYWIucnpzcCA9IDA7XG4gICAgICAgIHRoaXMubWF4TGFiLnJ6c3AgPSAwO1xuICAgICAgICB0aGlzLmNtYkxhYi5yenNwID0gMDtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogVXBkYXRlIGVhY2ggZWxlbWVudHMgc3R5bGUgYmFzZWQgb24gb3B0aW9uc1xuICAgICAgICovXG4gICAgICBtYW5hZ2VFbGVtZW50c1N0eWxlOiBmdW5jdGlvbigpIHtcblxuICAgICAgICBpZiAoIXRoaXMucmFuZ2UpXG4gICAgICAgICAgdGhpcy5tYXhILmNzcygnZGlzcGxheScsICdub25lJyk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aGlzLm1heEguY3NzKCdkaXNwbGF5JywgJycpO1xuXG5cbiAgICAgICAgdGhpcy5hbHdheXNIaWRlKHRoaXMuZmxyTGFiLCB0aGlzLm9wdGlvbnMuc2hvd1RpY2tzVmFsdWVzIHx8IHRoaXMub3B0aW9ucy5oaWRlTGltaXRMYWJlbHMpO1xuICAgICAgICB0aGlzLmFsd2F5c0hpZGUodGhpcy5jZWlsTGFiLCB0aGlzLm9wdGlvbnMuc2hvd1RpY2tzVmFsdWVzIHx8IHRoaXMub3B0aW9ucy5oaWRlTGltaXRMYWJlbHMpO1xuXG4gICAgICAgIHZhciBoaWRlTGFiZWxzRm9yVGlja3MgPSB0aGlzLm9wdGlvbnMuc2hvd1RpY2tzVmFsdWVzICYmICF0aGlzLmludGVybWVkaWF0ZVRpY2tzO1xuICAgICAgICB0aGlzLmFsd2F5c0hpZGUodGhpcy5taW5MYWIsIGhpZGVMYWJlbHNGb3JUaWNrcyB8fCB0aGlzLm9wdGlvbnMuaGlkZVBvaW50ZXJMYWJlbHMpO1xuICAgICAgICB0aGlzLmFsd2F5c0hpZGUodGhpcy5tYXhMYWIsIGhpZGVMYWJlbHNGb3JUaWNrcyB8fCAhdGhpcy5yYW5nZSB8fCB0aGlzLm9wdGlvbnMuaGlkZVBvaW50ZXJMYWJlbHMpO1xuICAgICAgICB0aGlzLmFsd2F5c0hpZGUodGhpcy5jbWJMYWIsIGhpZGVMYWJlbHNGb3JUaWNrcyB8fCAhdGhpcy5yYW5nZSB8fCB0aGlzLm9wdGlvbnMuaGlkZVBvaW50ZXJMYWJlbHMpO1xuICAgICAgICB0aGlzLmFsd2F5c0hpZGUodGhpcy5zZWxCYXIsICF0aGlzLnJhbmdlICYmICF0aGlzLm9wdGlvbnMuc2hvd1NlbGVjdGlvbkJhcik7XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy52ZXJ0aWNhbClcbiAgICAgICAgICB0aGlzLnNsaWRlckVsZW0uYWRkQ2xhc3MoJ3J6LXZlcnRpY2FsJyk7XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5kcmFnZ2FibGVSYW5nZSlcbiAgICAgICAgICB0aGlzLnNlbEJhci5hZGRDbGFzcygncnotZHJhZ2dhYmxlJyk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aGlzLnNlbEJhci5yZW1vdmVDbGFzcygncnotZHJhZ2dhYmxlJyk7XG5cbiAgICAgICAgaWYgKHRoaXMuaW50ZXJtZWRpYXRlVGlja3MgJiYgdGhpcy5vcHRpb25zLnNob3dUaWNrc1ZhbHVlcylcbiAgICAgICAgICB0aGlzLnRpY2tzLmFkZENsYXNzKCdyei10aWNrcy12YWx1ZXMtdW5kZXInKTtcbiAgICAgIH0sXG5cbiAgICAgIGFsd2F5c0hpZGU6IGZ1bmN0aW9uKGVsLCBoaWRlKSB7XG4gICAgICAgIGVsLnJ6QWx3YXlzSGlkZSA9IGhpZGU7XG4gICAgICAgIGlmIChoaWRlKVxuICAgICAgICAgIHRoaXMuaGlkZUVsKGVsKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRoaXMuc2hvd0VsKGVsKVxuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBNYW5hZ2UgdGhlIGV2ZW50cyBiaW5kaW5ncyBiYXNlZCBvbiByZWFkT25seSBhbmQgZGlzYWJsZWQgb3B0aW9uc1xuICAgICAgICpcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIG1hbmFnZUV2ZW50c0JpbmRpbmdzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5kaXNhYmxlZCB8fCB0aGlzLm9wdGlvbnMucmVhZE9ubHkpXG4gICAgICAgICAgdGhpcy51bmJpbmRFdmVudHMoKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRoaXMuYmluZEV2ZW50cygpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBTZXQgdGhlIGRpc2FibGVkIHN0YXRlIGJhc2VkIG9uIHJ6U2xpZGVyRGlzYWJsZWRcbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgICAgICovXG4gICAgICBzZXREaXNhYmxlZFN0YXRlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5kaXNhYmxlZCkge1xuICAgICAgICAgIHRoaXMuc2xpZGVyRWxlbS5hdHRyKCdkaXNhYmxlZCcsICdkaXNhYmxlZCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuc2xpZGVyRWxlbS5hdHRyKCdkaXNhYmxlZCcsIG51bGwpO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFJlc2V0IGxhYmVsIHZhbHVlc1xuICAgICAgICpcbiAgICAgICAqIEByZXR1cm4ge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgcmVzZXRMYWJlbHNWYWx1ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMubWluTGFiLnJ6c3YgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMubWF4TGFiLnJ6c3YgPSB1bmRlZmluZWQ7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEluaXRpYWxpemUgc2xpZGVyIGhhbmRsZXMgcG9zaXRpb25zIGFuZCBsYWJlbHNcbiAgICAgICAqXG4gICAgICAgKiBSdW4gb25seSBvbmNlIGR1cmluZyBpbml0aWFsaXphdGlvbiBhbmQgZXZlcnkgdGltZSB2aWV3IHBvcnQgY2hhbmdlcyBzaXplXG4gICAgICAgKlxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgaW5pdEhhbmRsZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnVwZGF0ZUxvd0hhbmRsZSh0aGlzLnZhbHVlVG9Qb3NpdGlvbih0aGlzLmxvd1ZhbHVlKSk7XG5cbiAgICAgICAgLypcbiAgICAgICAgIHRoZSBvcmRlciBoZXJlIGlzIGltcG9ydGFudCBzaW5jZSB0aGUgc2VsZWN0aW9uIGJhciBzaG91bGQgYmVcbiAgICAgICAgIHVwZGF0ZWQgYWZ0ZXIgdGhlIGhpZ2ggaGFuZGxlIGJ1dCBiZWZvcmUgdGhlIGNvbWJpbmVkIGxhYmVsXG4gICAgICAgICAqL1xuICAgICAgICBpZiAodGhpcy5yYW5nZSlcbiAgICAgICAgICB0aGlzLnVwZGF0ZUhpZ2hIYW5kbGUodGhpcy52YWx1ZVRvUG9zaXRpb24odGhpcy5oaWdoVmFsdWUpKTtcbiAgICAgICAgdGhpcy51cGRhdGVTZWxlY3Rpb25CYXIoKTtcbiAgICAgICAgaWYgKHRoaXMucmFuZ2UpXG4gICAgICAgICAgdGhpcy51cGRhdGVDbWJMYWJlbCgpO1xuXG4gICAgICAgIHRoaXMudXBkYXRlVGlja3NTY2FsZSgpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBUcmFuc2xhdGUgdmFsdWUgdG8gaHVtYW4gcmVhZGFibGUgZm9ybWF0XG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSB2YWx1ZVxuICAgICAgICogQHBhcmFtIHtqcUxpdGV9IGxhYmVsXG4gICAgICAgKiBAcGFyYW0ge1N0cmluZ30gd2hpY2hcbiAgICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW3VzZUN1c3RvbVRyXVxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgdHJhbnNsYXRlRm46IGZ1bmN0aW9uKHZhbHVlLCBsYWJlbCwgd2hpY2gsIHVzZUN1c3RvbVRyKSB7XG4gICAgICAgIHVzZUN1c3RvbVRyID0gdXNlQ3VzdG9tVHIgPT09IHVuZGVmaW5lZCA/IHRydWUgOiB1c2VDdXN0b21UcjtcblxuICAgICAgICB2YXIgdmFsU3RyID0gJycsXG4gICAgICAgICAgZ2V0RGltZW5zaW9uID0gZmFsc2UsXG4gICAgICAgICAgbm9MYWJlbEluamVjdGlvbiA9IGxhYmVsLmhhc0NsYXNzKCduby1sYWJlbC1pbmplY3Rpb24nKTtcblxuICAgICAgICBpZiAodXNlQ3VzdG9tVHIpIHtcbiAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLnN0ZXBzQXJyYXkgJiYgIXRoaXMub3B0aW9ucy5iaW5kSW5kZXhGb3JTdGVwc0FycmF5KVxuICAgICAgICAgICAgdmFsdWUgPSB0aGlzLmdldFN0ZXBWYWx1ZSh2YWx1ZSk7XG4gICAgICAgICAgdmFsU3RyID0gU3RyaW5nKHRoaXMuY3VzdG9tVHJGbih2YWx1ZSwgdGhpcy5vcHRpb25zLmlkLCB3aGljaCkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHZhbFN0ciA9IFN0cmluZyh2YWx1ZSlcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsYWJlbC5yenN2ID09PSB1bmRlZmluZWQgfHwgbGFiZWwucnpzdi5sZW5ndGggIT09IHZhbFN0ci5sZW5ndGggfHwgKGxhYmVsLnJ6c3YubGVuZ3RoID4gMCAmJiBsYWJlbC5yenNkID09PSAwKSkge1xuICAgICAgICAgIGdldERpbWVuc2lvbiA9IHRydWU7XG4gICAgICAgICAgbGFiZWwucnpzdiA9IHZhbFN0cjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghbm9MYWJlbEluamVjdGlvbikge1xuICAgICAgICAgIGxhYmVsLmh0bWwodmFsU3RyKTtcbiAgICAgICAgfVxuICAgICAgICA7XG5cbiAgICAgICAgdGhpcy5zY29wZVt3aGljaCArICdMYWJlbCddID0gdmFsU3RyO1xuXG4gICAgICAgIC8vIFVwZGF0ZSB3aWR0aCBvbmx5IHdoZW4gbGVuZ3RoIG9mIHRoZSBsYWJlbCBoYXZlIGNoYW5nZWRcbiAgICAgICAgaWYgKGdldERpbWVuc2lvbikge1xuICAgICAgICAgIHRoaXMuZ2V0RGltZW5zaW9uKGxhYmVsKTtcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBTZXQgbWF4aW11bSBhbmQgbWluaW11bSB2YWx1ZXMgZm9yIHRoZSBzbGlkZXIgYW5kIGVuc3VyZSB0aGUgbW9kZWwgYW5kIGhpZ2hcbiAgICAgICAqIHZhbHVlIG1hdGNoIHRoZXNlIGxpbWl0c1xuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgc2V0TWluQW5kTWF4OiBmdW5jdGlvbigpIHtcblxuICAgICAgICB0aGlzLnN0ZXAgPSArdGhpcy5vcHRpb25zLnN0ZXA7XG4gICAgICAgIHRoaXMucHJlY2lzaW9uID0gK3RoaXMub3B0aW9ucy5wcmVjaXNpb247XG5cbiAgICAgICAgdGhpcy5taW5WYWx1ZSA9IHRoaXMub3B0aW9ucy5mbG9vcjtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5sb2dTY2FsZSAmJiB0aGlzLm1pblZhbHVlID09PSAwKVxuICAgICAgICAgIHRocm93IEVycm9yKFwiQ2FuJ3QgdXNlIGZsb29yPTAgd2l0aCBsb2dhcml0aG1pYyBzY2FsZVwiKTtcblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmVuZm9yY2VTdGVwKSB7XG4gICAgICAgICAgdGhpcy5sb3dWYWx1ZSA9IHRoaXMucm91bmRTdGVwKHRoaXMubG93VmFsdWUpO1xuICAgICAgICAgIGlmICh0aGlzLnJhbmdlKVxuICAgICAgICAgICAgdGhpcy5oaWdoVmFsdWUgPSB0aGlzLnJvdW5kU3RlcCh0aGlzLmhpZ2hWYWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmNlaWwgIT0gbnVsbClcbiAgICAgICAgICB0aGlzLm1heFZhbHVlID0gdGhpcy5vcHRpb25zLmNlaWw7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aGlzLm1heFZhbHVlID0gdGhpcy5vcHRpb25zLmNlaWwgPSB0aGlzLnJhbmdlID8gdGhpcy5oaWdoVmFsdWUgOiB0aGlzLmxvd1ZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZW5mb3JjZVJhbmdlKSB7XG4gICAgICAgICAgdGhpcy5sb3dWYWx1ZSA9IHRoaXMuc2FuaXRpemVWYWx1ZSh0aGlzLmxvd1ZhbHVlKTtcbiAgICAgICAgICBpZiAodGhpcy5yYW5nZSlcbiAgICAgICAgICAgIHRoaXMuaGlnaFZhbHVlID0gdGhpcy5zYW5pdGl6ZVZhbHVlKHRoaXMuaGlnaFZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYXBwbHlMb3dWYWx1ZSgpO1xuICAgICAgICBpZiAodGhpcy5yYW5nZSlcbiAgICAgICAgICB0aGlzLmFwcGx5SGlnaFZhbHVlKCk7XG5cbiAgICAgICAgdGhpcy52YWx1ZVJhbmdlID0gdGhpcy5tYXhWYWx1ZSAtIHRoaXMubWluVmFsdWU7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEFkZHMgYWNjZXNzaWJpbGl0eSBhdHRyaWJ1dGVzXG4gICAgICAgKlxuICAgICAgICogUnVuIG9ubHkgb25jZSBkdXJpbmcgaW5pdGlhbGl6YXRpb25cbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgICAgICovXG4gICAgICBhZGRBY2Nlc3NpYmlsaXR5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5taW5ILmF0dHIoJ3JvbGUnLCAnc2xpZGVyJyk7XG4gICAgICAgIHRoaXMudXBkYXRlQXJpYUF0dHJpYnV0ZXMoKTtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5rZXlib2FyZFN1cHBvcnQgJiYgISh0aGlzLm9wdGlvbnMucmVhZE9ubHkgfHwgdGhpcy5vcHRpb25zLmRpc2FibGVkKSlcbiAgICAgICAgICB0aGlzLm1pbkguYXR0cigndGFiaW5kZXgnLCAnMCcpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhpcy5taW5ILmF0dHIoJ3RhYmluZGV4JywgJycpO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnZlcnRpY2FsKVxuICAgICAgICAgIHRoaXMubWluSC5hdHRyKCdhcmlhLW9yaWVudGF0aW9uJywgJ3ZlcnRpY2FsJyk7XG5cbiAgICAgICAgaWYgKHRoaXMucmFuZ2UpIHtcbiAgICAgICAgICB0aGlzLm1heEguYXR0cigncm9sZScsICdzbGlkZXInKTtcbiAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLmtleWJvYXJkU3VwcG9ydCAmJiAhKHRoaXMub3B0aW9ucy5yZWFkT25seSB8fCB0aGlzLm9wdGlvbnMuZGlzYWJsZWQpKVxuICAgICAgICAgICAgdGhpcy5tYXhILmF0dHIoJ3RhYmluZGV4JywgJzAnKTtcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aGlzLm1heEguYXR0cigndGFiaW5kZXgnLCAnJyk7XG4gICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy52ZXJ0aWNhbClcbiAgICAgICAgICAgIHRoaXMubWF4SC5hdHRyKCdhcmlhLW9yaWVudGF0aW9uJywgJ3ZlcnRpY2FsJyk7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogVXBkYXRlcyBhcmlhIGF0dHJpYnV0ZXMgYWNjb3JkaW5nIHRvIGN1cnJlbnQgdmFsdWVzXG4gICAgICAgKi9cbiAgICAgIHVwZGF0ZUFyaWFBdHRyaWJ1dGVzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5taW5ILmF0dHIoe1xuICAgICAgICAgICdhcmlhLXZhbHVlbm93JzogdGhpcy5zY29wZS5yelNsaWRlck1vZGVsLFxuICAgICAgICAgICdhcmlhLXZhbHVldGV4dCc6IHRoaXMuY3VzdG9tVHJGbih0aGlzLnNjb3BlLnJ6U2xpZGVyTW9kZWwsIHRoaXMub3B0aW9ucy5pZCwgJ21vZGVsJyksXG4gICAgICAgICAgJ2FyaWEtdmFsdWVtaW4nOiB0aGlzLm1pblZhbHVlLFxuICAgICAgICAgICdhcmlhLXZhbHVlbWF4JzogdGhpcy5tYXhWYWx1ZVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHRoaXMucmFuZ2UpIHtcbiAgICAgICAgICB0aGlzLm1heEguYXR0cih7XG4gICAgICAgICAgICAnYXJpYS12YWx1ZW5vdyc6IHRoaXMuc2NvcGUucnpTbGlkZXJIaWdoLFxuICAgICAgICAgICAgJ2FyaWEtdmFsdWV0ZXh0JzogdGhpcy5jdXN0b21UckZuKHRoaXMuc2NvcGUucnpTbGlkZXJIaWdoLCB0aGlzLm9wdGlvbnMuaWQsICdoaWdoJyksXG4gICAgICAgICAgICAnYXJpYS12YWx1ZW1pbic6IHRoaXMubWluVmFsdWUsXG4gICAgICAgICAgICAnYXJpYS12YWx1ZW1heCc6IHRoaXMubWF4VmFsdWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBDYWxjdWxhdGUgZGltZW5zaW9ucyB0aGF0IGFyZSBkZXBlbmRlbnQgb24gdmlldyBwb3J0IHNpemVcbiAgICAgICAqXG4gICAgICAgKiBSdW4gb25jZSBkdXJpbmcgaW5pdGlhbGl6YXRpb24gYW5kIGV2ZXJ5IHRpbWUgdmlldyBwb3J0IGNoYW5nZXMgc2l6ZS5cbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgICAgICovXG4gICAgICBjYWxjVmlld0RpbWVuc2lvbnM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgaGFuZGxlV2lkdGggPSB0aGlzLmdldERpbWVuc2lvbih0aGlzLm1pbkgpO1xuXG4gICAgICAgIHRoaXMuaGFuZGxlSGFsZkRpbSA9IGhhbmRsZVdpZHRoIC8gMjtcbiAgICAgICAgdGhpcy5iYXJEaW1lbnNpb24gPSB0aGlzLmdldERpbWVuc2lvbih0aGlzLmZ1bGxCYXIpO1xuXG4gICAgICAgIHRoaXMubWF4UG9zID0gdGhpcy5iYXJEaW1lbnNpb24gLSBoYW5kbGVXaWR0aDtcblxuICAgICAgICB0aGlzLmdldERpbWVuc2lvbih0aGlzLnNsaWRlckVsZW0pO1xuICAgICAgICB0aGlzLnNsaWRlckVsZW0ucnpzcCA9IHRoaXMuc2xpZGVyRWxlbVswXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVt0aGlzLnBvc2l0aW9uUHJvcGVydHldO1xuXG4gICAgICAgIGlmICh0aGlzLmluaXRIYXNSdW4pIHtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUZsb29yTGFiKCk7XG4gICAgICAgICAgdGhpcy51cGRhdGVDZWlsTGFiKCk7XG4gICAgICAgICAgdGhpcy5pbml0SGFuZGxlcygpO1xuICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAkdGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNlbGYudXBkYXRlVGlja3NTY2FsZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFVwZGF0ZSB0aGUgdGlja3MgcG9zaXRpb25cbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgICAgICovXG4gICAgICB1cGRhdGVUaWNrc1NjYWxlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMuc2hvd1RpY2tzKSByZXR1cm47XG5cbiAgICAgICAgdmFyIHRpY2tzQXJyYXkgPSB0aGlzLm9wdGlvbnMudGlja3NBcnJheSB8fCB0aGlzLmdldFRpY2tzQXJyYXkoKSxcbiAgICAgICAgICB0cmFuc2xhdGUgPSB0aGlzLm9wdGlvbnMudmVydGljYWwgPyAndHJhbnNsYXRlWScgOiAndHJhbnNsYXRlWCcsXG4gICAgICAgICAgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdClcbiAgICAgICAgICB0aWNrc0FycmF5LnJldmVyc2UoKTtcblxuICAgICAgICB0aGlzLnNjb3BlLnRpY2tzID0gdGlja3NBcnJheS5tYXAoZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICB2YXIgcG9zaXRpb24gPSBzZWxmLnZhbHVlVG9Qb3NpdGlvbih2YWx1ZSk7XG5cbiAgICAgICAgICBpZiAoc2VsZi5vcHRpb25zLnZlcnRpY2FsKVxuICAgICAgICAgICAgcG9zaXRpb24gPSBzZWxmLm1heFBvcyAtIHBvc2l0aW9uO1xuXG4gICAgICAgICAgdmFyIHRpY2sgPSB7XG4gICAgICAgICAgICBzZWxlY3RlZDogc2VsZi5pc1RpY2tTZWxlY3RlZCh2YWx1ZSksXG4gICAgICAgICAgICBzdHlsZToge1xuICAgICAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZSArICcoJyArIE1hdGgucm91bmQocG9zaXRpb24pICsgJ3B4KSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICAgIGlmICh0aWNrLnNlbGVjdGVkICYmIHNlbGYub3B0aW9ucy5nZXRTZWxlY3Rpb25CYXJDb2xvcikge1xuICAgICAgICAgICAgdGljay5zdHlsZVsnYmFja2dyb3VuZC1jb2xvciddID0gc2VsZi5nZXRTZWxlY3Rpb25CYXJDb2xvcigpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXRpY2suc2VsZWN0ZWQgJiYgc2VsZi5vcHRpb25zLmdldFRpY2tDb2xvcikge1xuICAgICAgICAgICAgdGljay5zdHlsZVsnYmFja2dyb3VuZC1jb2xvciddID0gc2VsZi5nZXRUaWNrQ29sb3IodmFsdWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc2VsZi5vcHRpb25zLnRpY2tzVG9vbHRpcCkge1xuICAgICAgICAgICAgdGljay50b29sdGlwID0gc2VsZi5vcHRpb25zLnRpY2tzVG9vbHRpcCh2YWx1ZSk7XG4gICAgICAgICAgICB0aWNrLnRvb2x0aXBQbGFjZW1lbnQgPSBzZWxmLm9wdGlvbnMudmVydGljYWwgPyAncmlnaHQnIDogJ3RvcCc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzZWxmLm9wdGlvbnMuc2hvd1RpY2tzVmFsdWVzKSB7XG4gICAgICAgICAgICB0aWNrLnZhbHVlID0gc2VsZi5nZXREaXNwbGF5VmFsdWUodmFsdWUsICd0aWNrLXZhbHVlJyk7XG4gICAgICAgICAgICBpZiAoc2VsZi5vcHRpb25zLnRpY2tzVmFsdWVzVG9vbHRpcCkge1xuICAgICAgICAgICAgICB0aWNrLnZhbHVlVG9vbHRpcCA9IHNlbGYub3B0aW9ucy50aWNrc1ZhbHVlc1Rvb2x0aXAodmFsdWUpO1xuICAgICAgICAgICAgICB0aWNrLnZhbHVlVG9vbHRpcFBsYWNlbWVudCA9IHNlbGYub3B0aW9ucy52ZXJ0aWNhbCA/ICdyaWdodCcgOiAndG9wJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNlbGYuZ2V0TGVnZW5kKSB7XG4gICAgICAgICAgICB2YXIgbGVnZW5kID0gc2VsZi5nZXRMZWdlbmQodmFsdWUsIHNlbGYub3B0aW9ucy5pZCk7XG4gICAgICAgICAgICBpZiAobGVnZW5kKVxuICAgICAgICAgICAgICB0aWNrLmxlZ2VuZCA9IGxlZ2VuZDtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRpY2s7XG4gICAgICAgIH0pO1xuICAgICAgfSxcblxuICAgICAgZ2V0VGlja3NBcnJheTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGVwID0gdGhpcy5zdGVwLFxuICAgICAgICAgIHRpY2tzQXJyYXkgPSBbXTtcbiAgICAgICAgaWYgKHRoaXMuaW50ZXJtZWRpYXRlVGlja3MpXG4gICAgICAgICAgc3RlcCA9IHRoaXMub3B0aW9ucy5zaG93VGlja3M7XG4gICAgICAgIGZvciAodmFyIHZhbHVlID0gdGhpcy5taW5WYWx1ZTsgdmFsdWUgPD0gdGhpcy5tYXhWYWx1ZTsgdmFsdWUgKz0gc3RlcCkge1xuICAgICAgICAgIHRpY2tzQXJyYXkucHVzaCh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRpY2tzQXJyYXk7XG4gICAgICB9LFxuXG4gICAgICBpc1RpY2tTZWxlY3RlZDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLnJhbmdlKSB7XG4gICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5zaG93U2VsZWN0aW9uQmFyRnJvbVZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICB2YXIgY2VudGVyID0gdGhpcy5vcHRpb25zLnNob3dTZWxlY3Rpb25CYXJGcm9tVmFsdWU7XG4gICAgICAgICAgICBpZiAodGhpcy5sb3dWYWx1ZSA+IGNlbnRlciAmJiB2YWx1ZSA+PSBjZW50ZXIgJiYgdmFsdWUgPD0gdGhpcy5sb3dWYWx1ZSlcbiAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLmxvd1ZhbHVlIDwgY2VudGVyICYmIHZhbHVlIDw9IGNlbnRlciAmJiB2YWx1ZSA+PSB0aGlzLmxvd1ZhbHVlKVxuICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAodGhpcy5vcHRpb25zLnNob3dTZWxlY3Rpb25CYXJFbmQpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSA+PSB0aGlzLmxvd1ZhbHVlKVxuICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAodGhpcy5vcHRpb25zLnNob3dTZWxlY3Rpb25CYXIgJiYgdmFsdWUgPD0gdGhpcy5sb3dWYWx1ZSlcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLnJhbmdlICYmIHZhbHVlID49IHRoaXMubG93VmFsdWUgJiYgdmFsdWUgPD0gdGhpcy5oaWdoVmFsdWUpXG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogVXBkYXRlIHBvc2l0aW9uIG9mIHRoZSBmbG9vciBsYWJlbFxuICAgICAgICpcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIHVwZGF0ZUZsb29yTGFiOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy50cmFuc2xhdGVGbih0aGlzLm1pblZhbHVlLCB0aGlzLmZsckxhYiwgJ2Zsb29yJyk7XG4gICAgICAgIHRoaXMuZ2V0RGltZW5zaW9uKHRoaXMuZmxyTGFiKTtcbiAgICAgICAgdmFyIHBvc2l0aW9uID0gdGhpcy5vcHRpb25zLnJpZ2h0VG9MZWZ0ID8gdGhpcy5iYXJEaW1lbnNpb24gLSB0aGlzLmZsckxhYi5yenNkIDogMDtcbiAgICAgICAgdGhpcy5zZXRQb3NpdGlvbih0aGlzLmZsckxhYiwgcG9zaXRpb24pO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBVcGRhdGUgcG9zaXRpb24gb2YgdGhlIGNlaWxpbmcgbGFiZWxcbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgICAgICovXG4gICAgICB1cGRhdGVDZWlsTGFiOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy50cmFuc2xhdGVGbih0aGlzLm1heFZhbHVlLCB0aGlzLmNlaWxMYWIsICdjZWlsJyk7XG4gICAgICAgIHRoaXMuZ2V0RGltZW5zaW9uKHRoaXMuY2VpbExhYik7XG4gICAgICAgIHZhciBwb3NpdGlvbiA9IHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdCA/IDAgOiB0aGlzLmJhckRpbWVuc2lvbiAtIHRoaXMuY2VpbExhYi5yenNkO1xuICAgICAgICB0aGlzLnNldFBvc2l0aW9uKHRoaXMuY2VpbExhYiwgcG9zaXRpb24pO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBVcGRhdGUgc2xpZGVyIGhhbmRsZXMgYW5kIGxhYmVsIHBvc2l0aW9uc1xuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSB3aGljaFxuICAgICAgICogQHBhcmFtIHtudW1iZXJ9IG5ld1Bvc1xuICAgICAgICovXG4gICAgICB1cGRhdGVIYW5kbGVzOiBmdW5jdGlvbih3aGljaCwgbmV3UG9zKSB7XG4gICAgICAgIGlmICh3aGljaCA9PT0gJ2xvd1ZhbHVlJylcbiAgICAgICAgICB0aGlzLnVwZGF0ZUxvd0hhbmRsZShuZXdQb3MpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhpcy51cGRhdGVIaWdoSGFuZGxlKG5ld1Bvcyk7XG5cbiAgICAgICAgdGhpcy51cGRhdGVTZWxlY3Rpb25CYXIoKTtcbiAgICAgICAgdGhpcy51cGRhdGVUaWNrc1NjYWxlKCk7XG4gICAgICAgIGlmICh0aGlzLnJhbmdlKVxuICAgICAgICAgIHRoaXMudXBkYXRlQ21iTGFiZWwoKTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSGVscGVyIGZ1bmN0aW9uIHRvIHdvcmsgb3V0IHRoZSBwb3NpdGlvbiBmb3IgaGFuZGxlIGxhYmVscyBkZXBlbmRpbmcgb24gUlRMIG9yIG5vdFxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBsYWJlbE5hbWUgbWF4TGFiIG9yIG1pbkxhYlxuICAgICAgICogQHBhcmFtIG5ld1Bvc1xuICAgICAgICpcbiAgICAgICAqIEByZXR1cm5zIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIGdldEhhbmRsZUxhYmVsUG9zOiBmdW5jdGlvbihsYWJlbE5hbWUsIG5ld1Bvcykge1xuICAgICAgICB2YXIgbGFiZWxSenNkID0gdGhpc1tsYWJlbE5hbWVdLnJ6c2QsXG4gICAgICAgICAgbmVhckhhbmRsZVBvcyA9IG5ld1BvcyAtIGxhYmVsUnpzZCAvIDIgKyB0aGlzLmhhbmRsZUhhbGZEaW0sXG4gICAgICAgICAgZW5kT2ZCYXJQb3MgPSB0aGlzLmJhckRpbWVuc2lvbiAtIGxhYmVsUnpzZDtcblxuICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5ib3VuZFBvaW50ZXJMYWJlbHMpXG4gICAgICAgICAgcmV0dXJuIG5lYXJIYW5kbGVQb3M7XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdCAmJiBsYWJlbE5hbWUgPT09ICdtaW5MYWInIHx8ICF0aGlzLm9wdGlvbnMucmlnaHRUb0xlZnQgJiYgbGFiZWxOYW1lID09PSAnbWF4TGFiJykge1xuICAgICAgICAgIHJldHVybiBNYXRoLm1pbihuZWFySGFuZGxlUG9zLCBlbmRPZkJhclBvcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIE1hdGgubWluKE1hdGgubWF4KG5lYXJIYW5kbGVQb3MsIDApLCBlbmRPZkJhclBvcyk7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogVXBkYXRlIGxvdyBzbGlkZXIgaGFuZGxlIHBvc2l0aW9uIGFuZCBsYWJlbFxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuZXdQb3NcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIHVwZGF0ZUxvd0hhbmRsZTogZnVuY3Rpb24obmV3UG9zKSB7XG4gICAgICAgIHRoaXMuc2V0UG9zaXRpb24odGhpcy5taW5ILCBuZXdQb3MpO1xuICAgICAgICB0aGlzLnRyYW5zbGF0ZUZuKHRoaXMubG93VmFsdWUsIHRoaXMubWluTGFiLCAnbW9kZWwnKTtcbiAgICAgICAgdGhpcy5zZXRQb3NpdGlvbih0aGlzLm1pbkxhYiwgdGhpcy5nZXRIYW5kbGVMYWJlbFBvcygnbWluTGFiJywgbmV3UG9zKSk7XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5nZXRQb2ludGVyQ29sb3IpIHtcbiAgICAgICAgICB2YXIgcG9pbnRlcmNvbG9yID0gdGhpcy5nZXRQb2ludGVyQ29sb3IoJ21pbicpO1xuICAgICAgICAgIHRoaXMuc2NvcGUubWluUG9pbnRlclN0eWxlID0ge1xuICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBwb2ludGVyY29sb3JcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5hdXRvSGlkZUxpbWl0TGFiZWxzKSB7XG4gICAgICAgICAgdGhpcy5zaEZsb29yQ2VpbCgpO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFVwZGF0ZSBoaWdoIHNsaWRlciBoYW5kbGUgcG9zaXRpb24gYW5kIGxhYmVsXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtudW1iZXJ9IG5ld1Bvc1xuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgdXBkYXRlSGlnaEhhbmRsZTogZnVuY3Rpb24obmV3UG9zKSB7XG4gICAgICAgIHRoaXMuc2V0UG9zaXRpb24odGhpcy5tYXhILCBuZXdQb3MpO1xuICAgICAgICB0aGlzLnRyYW5zbGF0ZUZuKHRoaXMuaGlnaFZhbHVlLCB0aGlzLm1heExhYiwgJ2hpZ2gnKTtcbiAgICAgICAgdGhpcy5zZXRQb3NpdGlvbih0aGlzLm1heExhYiwgdGhpcy5nZXRIYW5kbGVMYWJlbFBvcygnbWF4TGFiJywgbmV3UG9zKSk7XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5nZXRQb2ludGVyQ29sb3IpIHtcbiAgICAgICAgICB2YXIgcG9pbnRlcmNvbG9yID0gdGhpcy5nZXRQb2ludGVyQ29sb3IoJ21heCcpO1xuICAgICAgICAgIHRoaXMuc2NvcGUubWF4UG9pbnRlclN0eWxlID0ge1xuICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBwb2ludGVyY29sb3JcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuYXV0b0hpZGVMaW1pdExhYmVscykge1xuICAgICAgICAgIHRoaXMuc2hGbG9vckNlaWwoKTtcbiAgICAgICAgfVxuXG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFNob3cvaGlkZSBmbG9vci9jZWlsaW5nIGxhYmVsXG4gICAgICAgKlxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgc2hGbG9vckNlaWw6IGZ1bmN0aW9uKCkge1xuICAgICAgICAvLyBTaG93IGJhc2VkIG9ubHkgb24gaGlkZUxpbWl0TGFiZWxzIGlmIHBvaW50ZXIgbGFiZWxzIGFyZSBoaWRkZW5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5oaWRlUG9pbnRlckxhYmVscykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZmxIaWRkZW4gPSBmYWxzZSxcbiAgICAgICAgICBjbEhpZGRlbiA9IGZhbHNlLFxuICAgICAgICAgIGlzTWluTGFiQXRGbG9vciA9IHRoaXMuaXNMYWJlbEJlbG93Rmxvb3JMYWIodGhpcy5taW5MYWIpLFxuICAgICAgICAgIGlzTWluTGFiQXRDZWlsID0gdGhpcy5pc0xhYmVsQWJvdmVDZWlsTGFiKHRoaXMubWluTGFiKSxcbiAgICAgICAgICBpc01heExhYkF0Q2VpbCA9IHRoaXMuaXNMYWJlbEFib3ZlQ2VpbExhYih0aGlzLm1heExhYiksXG4gICAgICAgICAgaXNDbWJMYWJBdEZsb29yID0gdGhpcy5pc0xhYmVsQmVsb3dGbG9vckxhYih0aGlzLmNtYkxhYiksXG4gICAgICAgICAgaXNDbWJMYWJBdENlaWwgPSAgdGhpcy5pc0xhYmVsQWJvdmVDZWlsTGFiKHRoaXMuY21iTGFiKTtcblxuICAgICAgICBpZiAoaXNNaW5MYWJBdEZsb29yKSB7XG4gICAgICAgICAgZmxIaWRkZW4gPSB0cnVlO1xuICAgICAgICAgIHRoaXMuaGlkZUVsKHRoaXMuZmxyTGFiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmbEhpZGRlbiA9IGZhbHNlO1xuICAgICAgICAgIHRoaXMuc2hvd0VsKHRoaXMuZmxyTGFiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc01pbkxhYkF0Q2VpbCkge1xuICAgICAgICAgIGNsSGlkZGVuID0gdHJ1ZTtcbiAgICAgICAgICB0aGlzLmhpZGVFbCh0aGlzLmNlaWxMYWIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNsSGlkZGVuID0gZmFsc2U7XG4gICAgICAgICAgdGhpcy5zaG93RWwodGhpcy5jZWlsTGFiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJhbmdlKSB7XG4gICAgICAgICAgdmFyIGhpZGVDZWlsID0gdGhpcy5jbWJMYWJlbFNob3duID8gaXNDbWJMYWJBdENlaWwgOiBpc01heExhYkF0Q2VpbDtcbiAgICAgICAgICB2YXIgaGlkZUZsb29yID0gdGhpcy5jbWJMYWJlbFNob3duID8gaXNDbWJMYWJBdEZsb29yIDogaXNNaW5MYWJBdEZsb29yO1xuXG4gICAgICAgICAgaWYgKGhpZGVDZWlsKSB7XG4gICAgICAgICAgICB0aGlzLmhpZGVFbCh0aGlzLmNlaWxMYWIpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoIWNsSGlkZGVuKSB7XG4gICAgICAgICAgICB0aGlzLnNob3dFbCh0aGlzLmNlaWxMYWIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEhpZGUgb3Igc2hvdyBmbG9vciBsYWJlbFxuICAgICAgICAgIGlmIChoaWRlRmxvb3IpIHtcbiAgICAgICAgICAgIHRoaXMuaGlkZUVsKHRoaXMuZmxyTGFiKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKCFmbEhpZGRlbikge1xuICAgICAgICAgICAgdGhpcy5zaG93RWwodGhpcy5mbHJMYWIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgaXNMYWJlbEJlbG93Rmxvb3JMYWI6IGZ1bmN0aW9uKGxhYmVsKSB7XG4gICAgICAgIHZhciBpc1JUTCA9IHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdCxcbiAgICAgICAgICBwb3MgPSBsYWJlbC5yenNwLFxuICAgICAgICAgIGRpbSA9IGxhYmVsLnJ6c2QsXG4gICAgICAgICAgZmxvb3JQb3MgPSB0aGlzLmZsckxhYi5yenNwLFxuICAgICAgICAgIGZsb29yRGltID0gdGhpcy5mbHJMYWIucnpzZDtcbiAgICAgICAgcmV0dXJuIGlzUlRMID9cbiAgICAgICAgcG9zICsgZGltID49IGZsb29yUG9zIC0gMiA6XG4gICAgICAgIHBvcyA8PSBmbG9vclBvcyArIGZsb29yRGltICsgMjtcbiAgICAgIH0sXG5cbiAgICAgIGlzTGFiZWxBYm92ZUNlaWxMYWI6IGZ1bmN0aW9uKGxhYmVsKSB7XG4gICAgICAgIHZhciBpc1JUTCA9IHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdCxcbiAgICAgICAgICBwb3MgPSBsYWJlbC5yenNwLFxuICAgICAgICAgIGRpbSA9IGxhYmVsLnJ6c2QsXG4gICAgICAgICAgY2VpbFBvcyA9IHRoaXMuY2VpbExhYi5yenNwLFxuICAgICAgICAgIGNlaWxEaW0gPSB0aGlzLmNlaWxMYWIucnpzZDtcbiAgICAgICAgcmV0dXJuIGlzUlRMID9cbiAgICAgICAgcG9zIDw9IGNlaWxQb3MgKyBjZWlsRGltICsgMiA6XG4gICAgICAgIHBvcyArIGRpbSA+PSBjZWlsUG9zIC0gMjtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogVXBkYXRlIHNsaWRlciBzZWxlY3Rpb24gYmFyLCBjb21iaW5lZCBsYWJlbCBhbmQgcmFuZ2UgbGFiZWxcbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgICAgICovXG4gICAgICB1cGRhdGVTZWxlY3Rpb25CYXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcG9zaXRpb24gPSAwLFxuICAgICAgICAgIGRpbWVuc2lvbiA9IDAsXG4gICAgICAgICAgaXNTZWxlY3Rpb25CYXJGcm9tUmlnaHQgPSB0aGlzLm9wdGlvbnMucmlnaHRUb0xlZnQgPyAhdGhpcy5vcHRpb25zLnNob3dTZWxlY3Rpb25CYXJFbmQgOiB0aGlzLm9wdGlvbnMuc2hvd1NlbGVjdGlvbkJhckVuZCxcbiAgICAgICAgICBwb3NpdGlvbkZvclJhbmdlID0gdGhpcy5vcHRpb25zLnJpZ2h0VG9MZWZ0ID8gdGhpcy5tYXhILnJ6c3AgKyB0aGlzLmhhbmRsZUhhbGZEaW0gOiB0aGlzLm1pbkgucnpzcCArIHRoaXMuaGFuZGxlSGFsZkRpbTtcblxuICAgICAgICBpZiAodGhpcy5yYW5nZSkge1xuICAgICAgICAgIGRpbWVuc2lvbiA9IE1hdGguYWJzKHRoaXMubWF4SC5yenNwIC0gdGhpcy5taW5ILnJ6c3ApO1xuICAgICAgICAgIHBvc2l0aW9uID0gcG9zaXRpb25Gb3JSYW5nZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLnNob3dTZWxlY3Rpb25CYXJGcm9tVmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHZhciBjZW50ZXIgPSB0aGlzLm9wdGlvbnMuc2hvd1NlbGVjdGlvbkJhckZyb21WYWx1ZSxcbiAgICAgICAgICAgICAgY2VudGVyUG9zaXRpb24gPSB0aGlzLnZhbHVlVG9Qb3NpdGlvbihjZW50ZXIpLFxuICAgICAgICAgICAgICBpc01vZGVsR3JlYXRlclRoYW5DZW50ZXIgPSB0aGlzLm9wdGlvbnMucmlnaHRUb0xlZnQgPyB0aGlzLmxvd1ZhbHVlIDw9IGNlbnRlciA6IHRoaXMubG93VmFsdWUgPiBjZW50ZXI7XG4gICAgICAgICAgICBpZiAoaXNNb2RlbEdyZWF0ZXJUaGFuQ2VudGVyKSB7XG4gICAgICAgICAgICAgIGRpbWVuc2lvbiA9IHRoaXMubWluSC5yenNwIC0gY2VudGVyUG9zaXRpb247XG4gICAgICAgICAgICAgIHBvc2l0aW9uID0gY2VudGVyUG9zaXRpb24gKyB0aGlzLmhhbmRsZUhhbGZEaW07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgZGltZW5zaW9uID0gY2VudGVyUG9zaXRpb24gLSB0aGlzLm1pbkgucnpzcDtcbiAgICAgICAgICAgICAgcG9zaXRpb24gPSB0aGlzLm1pbkgucnpzcCArIHRoaXMuaGFuZGxlSGFsZkRpbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAoaXNTZWxlY3Rpb25CYXJGcm9tUmlnaHQpIHtcbiAgICAgICAgICAgIGRpbWVuc2lvbiA9IE1hdGguYWJzKHRoaXMubWF4UG9zIC0gdGhpcy5taW5ILnJ6c3ApICsgdGhpcy5oYW5kbGVIYWxmRGltO1xuICAgICAgICAgICAgcG9zaXRpb24gPSB0aGlzLm1pbkgucnpzcCArIHRoaXMuaGFuZGxlSGFsZkRpbTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGltZW5zaW9uID0gTWF0aC5hYnModGhpcy5tYXhILnJ6c3AgLSB0aGlzLm1pbkgucnpzcCkgKyB0aGlzLmhhbmRsZUhhbGZEaW07XG4gICAgICAgICAgICBwb3NpdGlvbiA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2V0RGltZW5zaW9uKHRoaXMuc2VsQmFyLCBkaW1lbnNpb24pO1xuICAgICAgICB0aGlzLnNldFBvc2l0aW9uKHRoaXMuc2VsQmFyLCBwb3NpdGlvbik7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZ2V0U2VsZWN0aW9uQmFyQ29sb3IpIHtcbiAgICAgICAgICB2YXIgY29sb3IgPSB0aGlzLmdldFNlbGVjdGlvbkJhckNvbG9yKCk7XG4gICAgICAgICAgdGhpcy5zY29wZS5iYXJTdHlsZSA9IHtcbiAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogY29sb3JcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFdyYXBwZXIgYXJvdW5kIHRoZSBnZXRTZWxlY3Rpb25CYXJDb2xvciBvZiB0aGUgdXNlciB0byBwYXNzIHRvXG4gICAgICAgKiBjb3JyZWN0IHBhcmFtZXRlcnNcbiAgICAgICAqL1xuICAgICAgZ2V0U2VsZWN0aW9uQmFyQ29sb3I6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5yYW5nZSlcbiAgICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLmdldFNlbGVjdGlvbkJhckNvbG9yKHRoaXMuc2NvcGUucnpTbGlkZXJNb2RlbCwgdGhpcy5zY29wZS5yelNsaWRlckhpZ2gpO1xuICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLmdldFNlbGVjdGlvbkJhckNvbG9yKHRoaXMuc2NvcGUucnpTbGlkZXJNb2RlbCk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFdyYXBwZXIgYXJvdW5kIHRoZSBnZXRQb2ludGVyQ29sb3Igb2YgdGhlIHVzZXIgdG8gcGFzcyB0b1xuICAgICAgICogY29ycmVjdCBwYXJhbWV0ZXJzXG4gICAgICAgKi9cbiAgICAgIGdldFBvaW50ZXJDb2xvcjogZnVuY3Rpb24ocG9pbnRlclR5cGUpIHtcbiAgICAgICAgaWYgKHBvaW50ZXJUeXBlID09PSAnbWF4Jykge1xuICAgICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMuZ2V0UG9pbnRlckNvbG9yKHRoaXMuc2NvcGUucnpTbGlkZXJIaWdoLCBwb2ludGVyVHlwZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5nZXRQb2ludGVyQ29sb3IodGhpcy5zY29wZS5yelNsaWRlck1vZGVsLCBwb2ludGVyVHlwZSk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFdyYXBwZXIgYXJvdW5kIHRoZSBnZXRUaWNrQ29sb3Igb2YgdGhlIHVzZXIgdG8gcGFzcyB0b1xuICAgICAgICogY29ycmVjdCBwYXJhbWV0ZXJzXG4gICAgICAgKi9cbiAgICAgIGdldFRpY2tDb2xvcjogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5nZXRUaWNrQ29sb3IodmFsdWUpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBVcGRhdGUgY29tYmluZWQgbGFiZWwgcG9zaXRpb24gYW5kIHZhbHVlXG4gICAgICAgKlxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgdXBkYXRlQ21iTGFiZWw6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgaXNMYWJlbE92ZXJsYXAgPSBudWxsO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJpZ2h0VG9MZWZ0KSB7XG4gICAgICAgICAgaXNMYWJlbE92ZXJsYXAgPSB0aGlzLm1pbkxhYi5yenNwIC0gdGhpcy5taW5MYWIucnpzZCAtIDEwIDw9IHRoaXMubWF4TGFiLnJ6c3A7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaXNMYWJlbE92ZXJsYXAgPSB0aGlzLm1pbkxhYi5yenNwICsgdGhpcy5taW5MYWIucnpzZCArIDEwID49IHRoaXMubWF4TGFiLnJ6c3A7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNMYWJlbE92ZXJsYXApIHtcbiAgICAgICAgICB2YXIgbG93VHIgPSB0aGlzLmdldERpc3BsYXlWYWx1ZSh0aGlzLmxvd1ZhbHVlLCAnbW9kZWwnKSxcbiAgICAgICAgICAgIGhpZ2hUciA9IHRoaXMuZ2V0RGlzcGxheVZhbHVlKHRoaXMuaGlnaFZhbHVlLCAnaGlnaCcpLFxuICAgICAgICAgICAgbGFiZWxWYWwgPSAnJztcbiAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLm1lcmdlUmFuZ2VMYWJlbHNJZlNhbWUgJiYgbG93VHIgPT09IGhpZ2hUcikge1xuICAgICAgICAgICAgbGFiZWxWYWwgPSBsb3dUcjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGFiZWxWYWwgPSB0aGlzLm9wdGlvbnMucmlnaHRUb0xlZnQgPyBoaWdoVHIgKyAnIC0gJyArIGxvd1RyIDogbG93VHIgKyAnIC0gJyArIGhpZ2hUcjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLnRyYW5zbGF0ZUZuKGxhYmVsVmFsLCB0aGlzLmNtYkxhYiwgJ2NtYicsIGZhbHNlKTtcbiAgICAgICAgICB2YXIgcG9zID0gdGhpcy5vcHRpb25zLmJvdW5kUG9pbnRlckxhYmVscyA/IE1hdGgubWluKFxuICAgICAgICAgICAgTWF0aC5tYXgoXG4gICAgICAgICAgICAgIHRoaXMuc2VsQmFyLnJ6c3AgKyB0aGlzLnNlbEJhci5yenNkIC8gMiAtIHRoaXMuY21iTGFiLnJ6c2QgLyAyLFxuICAgICAgICAgICAgICAwXG4gICAgICAgICAgICApLFxuICAgICAgICAgICAgdGhpcy5iYXJEaW1lbnNpb24gLSB0aGlzLmNtYkxhYi5yenNkXG4gICAgICAgICAgKSA6IHRoaXMuc2VsQmFyLnJ6c3AgKyB0aGlzLnNlbEJhci5yenNkIC8gMiAtIHRoaXMuY21iTGFiLnJ6c2QgLyAyO1xuXG4gICAgICAgICAgdGhpcy5zZXRQb3NpdGlvbih0aGlzLmNtYkxhYiwgcG9zKTtcbiAgICAgICAgICB0aGlzLmNtYkxhYmVsU2hvd24gPSB0cnVlO1xuICAgICAgICAgIHRoaXMuaGlkZUVsKHRoaXMubWluTGFiKTtcbiAgICAgICAgICB0aGlzLmhpZGVFbCh0aGlzLm1heExhYik7XG4gICAgICAgICAgdGhpcy5zaG93RWwodGhpcy5jbWJMYWIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuY21iTGFiZWxTaG93biA9IGZhbHNlO1xuICAgICAgICAgIHRoaXMuc2hvd0VsKHRoaXMubWF4TGFiKTtcbiAgICAgICAgICB0aGlzLnNob3dFbCh0aGlzLm1pbkxhYik7XG4gICAgICAgICAgdGhpcy5oaWRlRWwodGhpcy5jbWJMYWIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuYXV0b0hpZGVMaW1pdExhYmVscykge1xuICAgICAgICAgIHRoaXMuc2hGbG9vckNlaWwoKTtcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBSZXR1cm4gdGhlIHRyYW5zbGF0ZWQgdmFsdWUgaWYgYSB0cmFuc2xhdGUgZnVuY3Rpb24gaXMgcHJvdmlkZWQgZWxzZSB0aGUgb3JpZ2luYWwgdmFsdWVcbiAgICAgICAqIEBwYXJhbSB2YWx1ZVxuICAgICAgICogQHBhcmFtIHdoaWNoIGlmIGl0J3MgbWluIG9yIG1heCBoYW5kbGVcbiAgICAgICAqIEByZXR1cm5zIHsqfVxuICAgICAgICovXG4gICAgICBnZXREaXNwbGF5VmFsdWU6IGZ1bmN0aW9uKHZhbHVlLCB3aGljaCkge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnN0ZXBzQXJyYXkgJiYgIXRoaXMub3B0aW9ucy5iaW5kSW5kZXhGb3JTdGVwc0FycmF5KSB7XG4gICAgICAgICAgdmFsdWUgPSB0aGlzLmdldFN0ZXBWYWx1ZSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuY3VzdG9tVHJGbih2YWx1ZSwgdGhpcy5vcHRpb25zLmlkLCB3aGljaCk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFJvdW5kIHZhbHVlIHRvIHN0ZXAgYW5kIHByZWNpc2lvbiBiYXNlZCBvbiBtaW5WYWx1ZVxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZVxuICAgICAgICogQHBhcmFtIHtudW1iZXJ9IGN1c3RvbVN0ZXAgYSBjdXN0b20gc3RlcCB0byBvdmVycmlkZSB0aGUgZGVmaW5lZCBzdGVwXG4gICAgICAgKiBAcmV0dXJucyB7bnVtYmVyfVxuICAgICAgICovXG4gICAgICByb3VuZFN0ZXA6IGZ1bmN0aW9uKHZhbHVlLCBjdXN0b21TdGVwKSB7XG4gICAgICAgIHZhciBzdGVwID0gY3VzdG9tU3RlcCA/IGN1c3RvbVN0ZXAgOiB0aGlzLnN0ZXAsXG4gICAgICAgICAgc3RlcHBlZERpZmZlcmVuY2UgPSBwYXJzZUZsb2F0KCh2YWx1ZSAtIHRoaXMubWluVmFsdWUpIC8gc3RlcCkudG9QcmVjaXNpb24oMTIpO1xuICAgICAgICBzdGVwcGVkRGlmZmVyZW5jZSA9IE1hdGgucm91bmQoK3N0ZXBwZWREaWZmZXJlbmNlKSAqIHN0ZXA7XG4gICAgICAgIHZhciBuZXdWYWx1ZSA9ICh0aGlzLm1pblZhbHVlICsgc3RlcHBlZERpZmZlcmVuY2UpLnRvRml4ZWQodGhpcy5wcmVjaXNpb24pO1xuICAgICAgICByZXR1cm4gK25ld1ZhbHVlO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBIaWRlIGVsZW1lbnRcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0gZWxlbWVudFxuICAgICAgICogQHJldHVybnMge2pxTGl0ZX0gVGhlIGpxTGl0ZSB3cmFwcGVkIERPTSBlbGVtZW50XG4gICAgICAgKi9cbiAgICAgIGhpZGVFbDogZnVuY3Rpb24oZWxlbWVudCkge1xuICAgICAgICByZXR1cm4gZWxlbWVudC5jc3Moe1xuICAgICAgICAgIHZpc2liaWxpdHk6ICdoaWRkZW4nXG4gICAgICAgIH0pO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBTaG93IGVsZW1lbnRcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0gZWxlbWVudCBUaGUganFMaXRlIHdyYXBwZWQgRE9NIGVsZW1lbnRcbiAgICAgICAqIEByZXR1cm5zIHtqcUxpdGV9IFRoZSBqcUxpdGVcbiAgICAgICAqL1xuICAgICAgc2hvd0VsOiBmdW5jdGlvbihlbGVtZW50KSB7XG4gICAgICAgIGlmICghIWVsZW1lbnQucnpBbHdheXNIaWRlKSB7XG4gICAgICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZWxlbWVudC5jc3Moe1xuICAgICAgICAgIHZpc2liaWxpdHk6ICd2aXNpYmxlJ1xuICAgICAgICB9KTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogU2V0IGVsZW1lbnQgbGVmdC90b3AgcG9zaXRpb24gZGVwZW5kaW5nIG9uIHdoZXRoZXIgc2xpZGVyIGlzIGhvcml6b250YWwgb3IgdmVydGljYWxcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0ge2pxTGl0ZX0gZWxlbSBUaGUganFMaXRlIHdyYXBwZWQgRE9NIGVsZW1lbnRcbiAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSBwb3NcbiAgICAgICAqIEByZXR1cm5zIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIHNldFBvc2l0aW9uOiBmdW5jdGlvbihlbGVtLCBwb3MpIHtcbiAgICAgICAgZWxlbS5yenNwID0gcG9zO1xuICAgICAgICB2YXIgY3NzID0ge307XG4gICAgICAgIGNzc1t0aGlzLnBvc2l0aW9uUHJvcGVydHldID0gTWF0aC5yb3VuZChwb3MpICsgJ3B4JztcbiAgICAgICAgZWxlbS5jc3MoY3NzKTtcbiAgICAgICAgcmV0dXJuIHBvcztcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogR2V0IGVsZW1lbnQgd2lkdGgvaGVpZ2h0IGRlcGVuZGluZyBvbiB3aGV0aGVyIHNsaWRlciBpcyBob3Jpem9udGFsIG9yIHZlcnRpY2FsXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtqcUxpdGV9IGVsZW0gVGhlIGpxTGl0ZSB3cmFwcGVkIERPTSBlbGVtZW50XG4gICAgICAgKiBAcmV0dXJucyB7bnVtYmVyfVxuICAgICAgICovXG4gICAgICBnZXREaW1lbnNpb246IGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgdmFyIHZhbCA9IGVsZW1bMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMudmVydGljYWwpXG4gICAgICAgICAgZWxlbS5yenNkID0gKHZhbC5ib3R0b20gLSB2YWwudG9wKSAqIHRoaXMub3B0aW9ucy5zY2FsZTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGVsZW0ucnpzZCA9ICh2YWwucmlnaHQgLSB2YWwubGVmdCkgKiB0aGlzLm9wdGlvbnMuc2NhbGU7XG4gICAgICAgIHJldHVybiBlbGVtLnJ6c2Q7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFNldCBlbGVtZW50IHdpZHRoL2hlaWdodCBkZXBlbmRpbmcgb24gd2hldGhlciBzbGlkZXIgaXMgaG9yaXpvbnRhbCBvciB2ZXJ0aWNhbFxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7anFMaXRlfSBlbGVtICBUaGUganFMaXRlIHdyYXBwZWQgRE9NIGVsZW1lbnRcbiAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkaW1cbiAgICAgICAqIEByZXR1cm5zIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIHNldERpbWVuc2lvbjogZnVuY3Rpb24oZWxlbSwgZGltKSB7XG4gICAgICAgIGVsZW0ucnpzZCA9IGRpbTtcbiAgICAgICAgdmFyIGNzcyA9IHt9O1xuICAgICAgICBjc3NbdGhpcy5kaW1lbnNpb25Qcm9wZXJ0eV0gPSBNYXRoLnJvdW5kKGRpbSkgKyAncHgnO1xuICAgICAgICBlbGVtLmNzcyhjc3MpO1xuICAgICAgICByZXR1cm4gZGltO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBSZXR1cm5zIGEgdmFsdWUgdGhhdCBpcyB3aXRoaW4gc2xpZGVyIHJhbmdlXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtudW1iZXJ9IHZhbFxuICAgICAgICogQHJldHVybnMge251bWJlcn1cbiAgICAgICAqL1xuICAgICAgc2FuaXRpemVWYWx1ZTogZnVuY3Rpb24odmFsKSB7XG4gICAgICAgIHJldHVybiBNYXRoLm1pbihNYXRoLm1heCh2YWwsIHRoaXMubWluVmFsdWUpLCB0aGlzLm1heFZhbHVlKTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogVHJhbnNsYXRlIHZhbHVlIHRvIHBpeGVsIHBvc2l0aW9uXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtudW1iZXJ9IHZhbFxuICAgICAgICogQHJldHVybnMge251bWJlcn1cbiAgICAgICAqL1xuICAgICAgdmFsdWVUb1Bvc2l0aW9uOiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgdmFyIGZuID0gdGhpcy5saW5lYXJWYWx1ZVRvUG9zaXRpb247XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuY3VzdG9tVmFsdWVUb1Bvc2l0aW9uKVxuICAgICAgICAgIGZuID0gdGhpcy5vcHRpb25zLmN1c3RvbVZhbHVlVG9Qb3NpdGlvbjtcbiAgICAgICAgZWxzZSBpZiAodGhpcy5vcHRpb25zLmxvZ1NjYWxlKVxuICAgICAgICAgIGZuID0gdGhpcy5sb2dWYWx1ZVRvUG9zaXRpb247XG5cbiAgICAgICAgdmFsID0gdGhpcy5zYW5pdGl6ZVZhbHVlKHZhbCk7XG4gICAgICAgIHZhciBwZXJjZW50ID0gZm4odmFsLCB0aGlzLm1pblZhbHVlLCB0aGlzLm1heFZhbHVlKSB8fCAwO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJpZ2h0VG9MZWZ0KVxuICAgICAgICAgIHBlcmNlbnQgPSAxIC0gcGVyY2VudDtcbiAgICAgICAgcmV0dXJuIHBlcmNlbnQgKiB0aGlzLm1heFBvcztcbiAgICAgIH0sXG5cbiAgICAgIGxpbmVhclZhbHVlVG9Qb3NpdGlvbjogZnVuY3Rpb24odmFsLCBtaW5WYWwsIG1heFZhbCkge1xuICAgICAgICB2YXIgcmFuZ2UgPSBtYXhWYWwgLSBtaW5WYWw7XG4gICAgICAgIHJldHVybiAodmFsIC0gbWluVmFsKSAvIHJhbmdlO1xuICAgICAgfSxcblxuICAgICAgbG9nVmFsdWVUb1Bvc2l0aW9uOiBmdW5jdGlvbih2YWwsIG1pblZhbCwgbWF4VmFsKSB7XG4gICAgICAgIHZhbCA9IE1hdGgubG9nKHZhbCk7XG4gICAgICAgIG1pblZhbCA9IE1hdGgubG9nKG1pblZhbCk7XG4gICAgICAgIG1heFZhbCA9IE1hdGgubG9nKG1heFZhbCk7XG4gICAgICAgIHZhciByYW5nZSA9IG1heFZhbCAtIG1pblZhbDtcbiAgICAgICAgcmV0dXJuICh2YWwgLSBtaW5WYWwpIC8gcmFuZ2U7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFRyYW5zbGF0ZSBwb3NpdGlvbiB0byBtb2RlbCB2YWx1ZVxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSBwb3NpdGlvblxuICAgICAgICogQHJldHVybnMge251bWJlcn1cbiAgICAgICAqL1xuICAgICAgcG9zaXRpb25Ub1ZhbHVlOiBmdW5jdGlvbihwb3NpdGlvbikge1xuICAgICAgICB2YXIgcGVyY2VudCA9IHBvc2l0aW9uIC8gdGhpcy5tYXhQb3M7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMucmlnaHRUb0xlZnQpXG4gICAgICAgICAgcGVyY2VudCA9IDEgLSBwZXJjZW50O1xuICAgICAgICB2YXIgZm4gPSB0aGlzLmxpbmVhclBvc2l0aW9uVG9WYWx1ZTtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5jdXN0b21Qb3NpdGlvblRvVmFsdWUpXG4gICAgICAgICAgZm4gPSB0aGlzLm9wdGlvbnMuY3VzdG9tUG9zaXRpb25Ub1ZhbHVlO1xuICAgICAgICBlbHNlIGlmICh0aGlzLm9wdGlvbnMubG9nU2NhbGUpXG4gICAgICAgICAgZm4gPSB0aGlzLmxvZ1Bvc2l0aW9uVG9WYWx1ZTtcbiAgICAgICAgcmV0dXJuIGZuKHBlcmNlbnQsIHRoaXMubWluVmFsdWUsIHRoaXMubWF4VmFsdWUpIHx8IDA7XG4gICAgICB9LFxuXG4gICAgICBsaW5lYXJQb3NpdGlvblRvVmFsdWU6IGZ1bmN0aW9uKHBlcmNlbnQsIG1pblZhbCwgbWF4VmFsKSB7XG4gICAgICAgIHJldHVybiBwZXJjZW50ICogKG1heFZhbCAtIG1pblZhbCkgKyBtaW5WYWw7XG4gICAgICB9LFxuXG4gICAgICBsb2dQb3NpdGlvblRvVmFsdWU6IGZ1bmN0aW9uKHBlcmNlbnQsIG1pblZhbCwgbWF4VmFsKSB7XG4gICAgICAgIG1pblZhbCA9IE1hdGgubG9nKG1pblZhbCk7XG4gICAgICAgIG1heFZhbCA9IE1hdGgubG9nKG1heFZhbCk7XG4gICAgICAgIHZhciB2YWx1ZSA9IHBlcmNlbnQgKiAobWF4VmFsIC0gbWluVmFsKSArIG1pblZhbDtcbiAgICAgICAgcmV0dXJuIE1hdGguZXhwKHZhbHVlKTtcbiAgICAgIH0sXG5cbiAgICAgIC8vIEV2ZW50c1xuICAgICAgLyoqXG4gICAgICAgKiBHZXQgdGhlIFgtY29vcmRpbmF0ZSBvciBZLWNvb3JkaW5hdGUgb2YgYW4gZXZlbnRcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0ge09iamVjdH0gZXZlbnQgIFRoZSBldmVudFxuICAgICAgICogQHJldHVybnMge251bWJlcn1cbiAgICAgICAqL1xuICAgICAgZ2V0RXZlbnRYWTogZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgLyogaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTIzMzYwNzUvMjgyODgyICovXG4gICAgICAgIC8vbm9pbnNwZWN0aW9uIEpTTGludFxuICAgICAgICB2YXIgY2xpZW50WFkgPSB0aGlzLm9wdGlvbnMudmVydGljYWwgPyAnY2xpZW50WScgOiAnY2xpZW50WCc7XG4gICAgICAgIGlmIChldmVudFtjbGllbnRYWV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJldHVybiBldmVudFtjbGllbnRYWV07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXZlbnQub3JpZ2luYWxFdmVudCA9PT0gdW5kZWZpbmVkID9cbiAgICAgICAgICBldmVudC50b3VjaGVzWzBdW2NsaWVudFhZXSA6IGV2ZW50Lm9yaWdpbmFsRXZlbnQudG91Y2hlc1swXVtjbGllbnRYWV07XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIENvbXB1dGUgdGhlIGV2ZW50IHBvc2l0aW9uIGRlcGVuZGluZyBvbiB3aGV0aGVyIHRoZSBzbGlkZXIgaXMgaG9yaXpvbnRhbCBvciB2ZXJ0aWNhbFxuICAgICAgICogQHBhcmFtIGV2ZW50XG4gICAgICAgKiBAcmV0dXJucyB7bnVtYmVyfVxuICAgICAgICovXG4gICAgICBnZXRFdmVudFBvc2l0aW9uOiBmdW5jdGlvbihldmVudCkge1xuICAgICAgICB2YXIgc2xpZGVyUG9zID0gdGhpcy5zbGlkZXJFbGVtLnJ6c3AsXG4gICAgICAgICAgZXZlbnRQb3MgPSAwO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnZlcnRpY2FsKVxuICAgICAgICAgIGV2ZW50UG9zID0gLXRoaXMuZ2V0RXZlbnRYWShldmVudCkgKyBzbGlkZXJQb3M7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBldmVudFBvcyA9IHRoaXMuZ2V0RXZlbnRYWShldmVudCkgLSBzbGlkZXJQb3M7XG4gICAgICAgIHJldHVybiBldmVudFBvcyAqIHRoaXMub3B0aW9ucy5zY2FsZSAtIHRoaXMuaGFuZGxlSGFsZkRpbTsgLy8gIzM0NiBoYW5kbGVIYWxmRGltIGlzIGFscmVhZHkgc2NhbGVkXG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEdldCBldmVudCBuYW1lcyBmb3IgbW92ZSBhbmQgZXZlbnQgZW5kXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtFdmVudH0gICAgZXZlbnQgICAgVGhlIGV2ZW50XG4gICAgICAgKlxuICAgICAgICogQHJldHVybiB7e21vdmVFdmVudDogc3RyaW5nLCBlbmRFdmVudDogc3RyaW5nfX1cbiAgICAgICAqL1xuICAgICAgZ2V0RXZlbnROYW1lczogZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgdmFyIGV2ZW50TmFtZXMgPSB7XG4gICAgICAgICAgbW92ZUV2ZW50OiAnJyxcbiAgICAgICAgICBlbmRFdmVudDogJydcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoZXZlbnQudG91Y2hlcyB8fCAoZXZlbnQub3JpZ2luYWxFdmVudCAhPT0gdW5kZWZpbmVkICYmIGV2ZW50Lm9yaWdpbmFsRXZlbnQudG91Y2hlcykpIHtcbiAgICAgICAgICBldmVudE5hbWVzLm1vdmVFdmVudCA9ICd0b3VjaG1vdmUnO1xuICAgICAgICAgIGV2ZW50TmFtZXMuZW5kRXZlbnQgPSAndG91Y2hlbmQnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGV2ZW50TmFtZXMubW92ZUV2ZW50ID0gJ21vdXNlbW92ZSc7XG4gICAgICAgICAgZXZlbnROYW1lcy5lbmRFdmVudCA9ICdtb3VzZXVwJztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBldmVudE5hbWVzO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBHZXQgdGhlIGhhbmRsZSBjbG9zZXN0IHRvIGFuIGV2ZW50LlxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSBldmVudCB7RXZlbnR9IFRoZSBldmVudFxuICAgICAgICogQHJldHVybnMge2pxTGl0ZX0gVGhlIGhhbmRsZSBjbG9zZXN0IHRvIHRoZSBldmVudC5cbiAgICAgICAqL1xuICAgICAgZ2V0TmVhcmVzdEhhbmRsZTogZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKCF0aGlzLnJhbmdlKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubWluSDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcG9zaXRpb24gPSB0aGlzLmdldEV2ZW50UG9zaXRpb24oZXZlbnQpLFxuICAgICAgICAgIGRpc3RhbmNlTWluID0gTWF0aC5hYnMocG9zaXRpb24gLSB0aGlzLm1pbkgucnpzcCksXG4gICAgICAgICAgZGlzdGFuY2VNYXggPSBNYXRoLmFicyhwb3NpdGlvbiAtIHRoaXMubWF4SC5yenNwKTtcbiAgICAgICAgaWYgKGRpc3RhbmNlTWluIDwgZGlzdGFuY2VNYXgpXG4gICAgICAgICAgcmV0dXJuIHRoaXMubWluSDtcbiAgICAgICAgZWxzZSBpZiAoZGlzdGFuY2VNaW4gPiBkaXN0YW5jZU1heClcbiAgICAgICAgICByZXR1cm4gdGhpcy5tYXhIO1xuICAgICAgICBlbHNlIGlmICghdGhpcy5vcHRpb25zLnJpZ2h0VG9MZWZ0KVxuICAgICAgICAvL2lmIGV2ZW50IGlzIGF0IHRoZSBzYW1lIGRpc3RhbmNlIGZyb20gbWluL21heCB0aGVuIGlmIGl0J3MgYXQgbGVmdCBvZiBtaW5ILCB3ZSByZXR1cm4gbWluSCBlbHNlIG1heEhcbiAgICAgICAgICByZXR1cm4gcG9zaXRpb24gPCB0aGlzLm1pbkgucnpzcCA/IHRoaXMubWluSCA6IHRoaXMubWF4SDtcbiAgICAgICAgZWxzZVxuICAgICAgICAvL3JldmVyc2UgaW4gcnRsXG4gICAgICAgICAgcmV0dXJuIHBvc2l0aW9uID4gdGhpcy5taW5ILnJ6c3AgPyB0aGlzLm1pbkggOiB0aGlzLm1heEg7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFdyYXBwZXIgZnVuY3Rpb24gdG8gZm9jdXMgYW4gYW5ndWxhciBlbGVtZW50XG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIGVsIHtBbmd1bGFyRWxlbWVudH0gdGhlIGVsZW1lbnQgdG8gZm9jdXNcbiAgICAgICAqL1xuICAgICAgZm9jdXNFbGVtZW50OiBmdW5jdGlvbihlbCkge1xuICAgICAgICB2YXIgRE9NX0VMRU1FTlQgPSAwO1xuICAgICAgICBlbFtET01fRUxFTUVOVF0uZm9jdXMoKTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQmluZCBtb3VzZSBhbmQgdG91Y2ggZXZlbnRzIHRvIHNsaWRlciBoYW5kbGVzXG4gICAgICAgKlxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgYmluZEV2ZW50czogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBiYXJUcmFja2luZywgYmFyU3RhcnQsIGJhck1vdmU7XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5kcmFnZ2FibGVSYW5nZSkge1xuICAgICAgICAgIGJhclRyYWNraW5nID0gJ3J6U2xpZGVyRHJhZyc7XG4gICAgICAgICAgYmFyU3RhcnQgPSB0aGlzLm9uRHJhZ1N0YXJ0O1xuICAgICAgICAgIGJhck1vdmUgPSB0aGlzLm9uRHJhZ01vdmU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYmFyVHJhY2tpbmcgPSAnbG93VmFsdWUnO1xuICAgICAgICAgIGJhclN0YXJ0ID0gdGhpcy5vblN0YXJ0O1xuICAgICAgICAgIGJhck1vdmUgPSB0aGlzLm9uTW92ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5vcHRpb25zLm9ubHlCaW5kSGFuZGxlcykge1xuICAgICAgICAgIHRoaXMuc2VsQmFyLm9uKCdtb3VzZWRvd24nLCBhbmd1bGFyLmJpbmQodGhpcywgYmFyU3RhcnQsIG51bGwsIGJhclRyYWNraW5nKSk7XG4gICAgICAgICAgdGhpcy5zZWxCYXIub24oJ21vdXNlZG93bicsIGFuZ3VsYXIuYmluZCh0aGlzLCBiYXJNb3ZlLCB0aGlzLnNlbEJhcikpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5kcmFnZ2FibGVSYW5nZU9ubHkpIHtcbiAgICAgICAgICB0aGlzLm1pbkgub24oJ21vdXNlZG93bicsIGFuZ3VsYXIuYmluZCh0aGlzLCBiYXJTdGFydCwgbnVsbCwgYmFyVHJhY2tpbmcpKTtcbiAgICAgICAgICB0aGlzLm1heEgub24oJ21vdXNlZG93bicsIGFuZ3VsYXIuYmluZCh0aGlzLCBiYXJTdGFydCwgbnVsbCwgYmFyVHJhY2tpbmcpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLm1pbkgub24oJ21vdXNlZG93bicsIGFuZ3VsYXIuYmluZCh0aGlzLCB0aGlzLm9uU3RhcnQsIHRoaXMubWluSCwgJ2xvd1ZhbHVlJykpO1xuICAgICAgICAgIGlmICh0aGlzLnJhbmdlKSB7XG4gICAgICAgICAgICB0aGlzLm1heEgub24oJ21vdXNlZG93bicsIGFuZ3VsYXIuYmluZCh0aGlzLCB0aGlzLm9uU3RhcnQsIHRoaXMubWF4SCwgJ2hpZ2hWYWx1ZScpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMub25seUJpbmRIYW5kbGVzKSB7XG4gICAgICAgICAgICB0aGlzLmZ1bGxCYXIub24oJ21vdXNlZG93bicsIGFuZ3VsYXIuYmluZCh0aGlzLCB0aGlzLm9uU3RhcnQsIG51bGwsIG51bGwpKTtcbiAgICAgICAgICAgIHRoaXMuZnVsbEJhci5vbignbW91c2Vkb3duJywgYW5ndWxhci5iaW5kKHRoaXMsIHRoaXMub25Nb3ZlLCB0aGlzLmZ1bGxCYXIpKTtcbiAgICAgICAgICAgIHRoaXMudGlja3Mub24oJ21vdXNlZG93bicsIGFuZ3VsYXIuYmluZCh0aGlzLCB0aGlzLm9uU3RhcnQsIG51bGwsIG51bGwpKTtcbiAgICAgICAgICAgIHRoaXMudGlja3Mub24oJ21vdXNlZG93bicsIGFuZ3VsYXIuYmluZCh0aGlzLCB0aGlzLm9uVGlja0NsaWNrLCB0aGlzLnRpY2tzKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMub25seUJpbmRIYW5kbGVzKSB7XG4gICAgICAgICAgdGhpcy5zZWxCYXIub24oJ3RvdWNoc3RhcnQnLCBhbmd1bGFyLmJpbmQodGhpcywgYmFyU3RhcnQsIG51bGwsIGJhclRyYWNraW5nKSk7XG4gICAgICAgICAgdGhpcy5zZWxCYXIub24oJ3RvdWNoc3RhcnQnLCBhbmd1bGFyLmJpbmQodGhpcywgYmFyTW92ZSwgdGhpcy5zZWxCYXIpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmRyYWdnYWJsZVJhbmdlT25seSkge1xuICAgICAgICAgIHRoaXMubWluSC5vbigndG91Y2hzdGFydCcsIGFuZ3VsYXIuYmluZCh0aGlzLCBiYXJTdGFydCwgbnVsbCwgYmFyVHJhY2tpbmcpKTtcbiAgICAgICAgICB0aGlzLm1heEgub24oJ3RvdWNoc3RhcnQnLCBhbmd1bGFyLmJpbmQodGhpcywgYmFyU3RhcnQsIG51bGwsIGJhclRyYWNraW5nKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5taW5ILm9uKCd0b3VjaHN0YXJ0JywgYW5ndWxhci5iaW5kKHRoaXMsIHRoaXMub25TdGFydCwgdGhpcy5taW5ILCAnbG93VmFsdWUnKSk7XG4gICAgICAgICAgaWYgKHRoaXMucmFuZ2UpIHtcbiAgICAgICAgICAgIHRoaXMubWF4SC5vbigndG91Y2hzdGFydCcsIGFuZ3VsYXIuYmluZCh0aGlzLCB0aGlzLm9uU3RhcnQsIHRoaXMubWF4SCwgJ2hpZ2hWYWx1ZScpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMub25seUJpbmRIYW5kbGVzKSB7XG4gICAgICAgICAgICB0aGlzLmZ1bGxCYXIub24oJ3RvdWNoc3RhcnQnLCBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vblN0YXJ0LCBudWxsLCBudWxsKSk7XG4gICAgICAgICAgICB0aGlzLmZ1bGxCYXIub24oJ3RvdWNoc3RhcnQnLCBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vbk1vdmUsIHRoaXMuZnVsbEJhcikpO1xuICAgICAgICAgICAgdGhpcy50aWNrcy5vbigndG91Y2hzdGFydCcsIGFuZ3VsYXIuYmluZCh0aGlzLCB0aGlzLm9uU3RhcnQsIG51bGwsIG51bGwpKTtcbiAgICAgICAgICAgIHRoaXMudGlja3Mub24oJ3RvdWNoc3RhcnQnLCBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vblRpY2tDbGljaywgdGhpcy50aWNrcykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMua2V5Ym9hcmRTdXBwb3J0KSB7XG4gICAgICAgICAgdGhpcy5taW5ILm9uKCdmb2N1cycsIGFuZ3VsYXIuYmluZCh0aGlzLCB0aGlzLm9uUG9pbnRlckZvY3VzLCB0aGlzLm1pbkgsICdsb3dWYWx1ZScpKTtcbiAgICAgICAgICBpZiAodGhpcy5yYW5nZSkge1xuICAgICAgICAgICAgdGhpcy5tYXhILm9uKCdmb2N1cycsIGFuZ3VsYXIuYmluZCh0aGlzLCB0aGlzLm9uUG9pbnRlckZvY3VzLCB0aGlzLm1heEgsICdoaWdoVmFsdWUnKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFVuYmluZCBtb3VzZSBhbmQgdG91Y2ggZXZlbnRzIHRvIHNsaWRlciBoYW5kbGVzXG4gICAgICAgKlxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgdW5iaW5kRXZlbnRzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5taW5ILm9mZigpO1xuICAgICAgICB0aGlzLm1heEgub2ZmKCk7XG4gICAgICAgIHRoaXMuZnVsbEJhci5vZmYoKTtcbiAgICAgICAgdGhpcy5zZWxCYXIub2ZmKCk7XG4gICAgICAgIHRoaXMudGlja3Mub2ZmKCk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIG9uU3RhcnQgZXZlbnQgaGFuZGxlclxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7P09iamVjdH0gcG9pbnRlciBUaGUganFMaXRlIHdyYXBwZWQgRE9NIGVsZW1lbnQ7IGlmIG51bGwsIHRoZSBjbG9zZXN0IGhhbmRsZSBpcyB1c2VkXG4gICAgICAgKiBAcGFyYW0gez9zdHJpbmd9IHJlZiAgICAgVGhlIG5hbWUgb2YgdGhlIGhhbmRsZSBiZWluZyBjaGFuZ2VkOyBpZiBudWxsLCB0aGUgY2xvc2VzdCBoYW5kbGUncyB2YWx1ZSBpcyBtb2RpZmllZFxuICAgICAgICogQHBhcmFtIHtFdmVudH0gICBldmVudCAgIFRoZSBldmVudFxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgb25TdGFydDogZnVuY3Rpb24ocG9pbnRlciwgcmVmLCBldmVudCkge1xuICAgICAgICB2YXIgZWhNb3ZlLCBlaEVuZCxcbiAgICAgICAgICBldmVudE5hbWVzID0gdGhpcy5nZXRFdmVudE5hbWVzKGV2ZW50KTtcblxuICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAvLyBXZSBoYXZlIHRvIGRvIHRoaXMgaW4gY2FzZSB0aGUgSFRNTCB3aGVyZSB0aGUgc2xpZGVycyBhcmUgb25cbiAgICAgICAgLy8gaGF2ZSBiZWVuIGFuaW1hdGVkIGludG8gdmlldy5cbiAgICAgICAgdGhpcy5jYWxjVmlld0RpbWVuc2lvbnMoKTtcblxuICAgICAgICBpZiAocG9pbnRlcikge1xuICAgICAgICAgIHRoaXMudHJhY2tpbmcgPSByZWY7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcG9pbnRlciA9IHRoaXMuZ2V0TmVhcmVzdEhhbmRsZShldmVudCk7XG4gICAgICAgICAgdGhpcy50cmFja2luZyA9IHBvaW50ZXIgPT09IHRoaXMubWluSCA/ICdsb3dWYWx1ZScgOiAnaGlnaFZhbHVlJztcbiAgICAgICAgfVxuXG4gICAgICAgIHBvaW50ZXIuYWRkQ2xhc3MoJ3J6LWFjdGl2ZScpO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMua2V5Ym9hcmRTdXBwb3J0KVxuICAgICAgICAgIHRoaXMuZm9jdXNFbGVtZW50KHBvaW50ZXIpO1xuXG4gICAgICAgIGVoTW92ZSA9IGFuZ3VsYXIuYmluZCh0aGlzLCB0aGlzLmRyYWdnaW5nLmFjdGl2ZSA/IHRoaXMub25EcmFnTW92ZSA6IHRoaXMub25Nb3ZlLCBwb2ludGVyKTtcbiAgICAgICAgZWhFbmQgPSBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vbkVuZCwgZWhNb3ZlKTtcblxuICAgICAgICAkZG9jdW1lbnQub24oZXZlbnROYW1lcy5tb3ZlRXZlbnQsIGVoTW92ZSk7XG4gICAgICAgICRkb2N1bWVudC5vbmUoZXZlbnROYW1lcy5lbmRFdmVudCwgZWhFbmQpO1xuICAgICAgICB0aGlzLmNhbGxPblN0YXJ0KCk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIG9uTW92ZSBldmVudCBoYW5kbGVyXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtqcUxpdGV9IHBvaW50ZXJcbiAgICAgICAqIEBwYXJhbSB7RXZlbnR9ICBldmVudCBUaGUgZXZlbnRcbiAgICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gIGZyb21UaWNrIGlmIHRoZSBldmVudCBvY2N1cmVkIG9uIGEgdGljayBvciBub3RcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIG9uTW92ZTogZnVuY3Rpb24ocG9pbnRlciwgZXZlbnQsIGZyb21UaWNrKSB7XG4gICAgICAgIHZhciBuZXdQb3MgPSB0aGlzLmdldEV2ZW50UG9zaXRpb24oZXZlbnQpLFxuICAgICAgICAgIG5ld1ZhbHVlLFxuICAgICAgICAgIGNlaWxWYWx1ZSA9IHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdCA/IHRoaXMubWluVmFsdWUgOiB0aGlzLm1heFZhbHVlLFxuICAgICAgICAgIGZsclZhbHVlID0gdGhpcy5vcHRpb25zLnJpZ2h0VG9MZWZ0ID8gdGhpcy5tYXhWYWx1ZSA6IHRoaXMubWluVmFsdWU7XG5cbiAgICAgICAgaWYgKG5ld1BvcyA8PSAwKSB7XG4gICAgICAgICAgbmV3VmFsdWUgPSBmbHJWYWx1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChuZXdQb3MgPj0gdGhpcy5tYXhQb3MpIHtcbiAgICAgICAgICBuZXdWYWx1ZSA9IGNlaWxWYWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdWYWx1ZSA9IHRoaXMucG9zaXRpb25Ub1ZhbHVlKG5ld1Bvcyk7XG4gICAgICAgICAgaWYgKGZyb21UaWNrICYmIGFuZ3VsYXIuaXNOdW1iZXIodGhpcy5vcHRpb25zLnNob3dUaWNrcykpXG4gICAgICAgICAgICBuZXdWYWx1ZSA9IHRoaXMucm91bmRTdGVwKG5ld1ZhbHVlLCB0aGlzLm9wdGlvbnMuc2hvd1RpY2tzKTtcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBuZXdWYWx1ZSA9IHRoaXMucm91bmRTdGVwKG5ld1ZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnBvc2l0aW9uVHJhY2tpbmdIYW5kbGUobmV3VmFsdWUpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBvbkVuZCBldmVudCBoYW5kbGVyXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtFdmVudH0gICAgZXZlbnQgICAgVGhlIGV2ZW50XG4gICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBlaE1vdmUgICBUaGUgdGhlIGJvdW5kIG1vdmUgZXZlbnQgaGFuZGxlclxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgb25FbmQ6IGZ1bmN0aW9uKGVoTW92ZSwgZXZlbnQpIHtcbiAgICAgICAgdmFyIG1vdmVFdmVudE5hbWUgPSB0aGlzLmdldEV2ZW50TmFtZXMoZXZlbnQpLm1vdmVFdmVudDtcblxuICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5rZXlib2FyZFN1cHBvcnQpIHtcbiAgICAgICAgICB0aGlzLm1pbkgucmVtb3ZlQ2xhc3MoJ3J6LWFjdGl2ZScpO1xuICAgICAgICAgIHRoaXMubWF4SC5yZW1vdmVDbGFzcygncnotYWN0aXZlJyk7XG4gICAgICAgICAgdGhpcy50cmFja2luZyA9ICcnO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZHJhZ2dpbmcuYWN0aXZlID0gZmFsc2U7XG5cbiAgICAgICAgJGRvY3VtZW50Lm9mZihtb3ZlRXZlbnROYW1lLCBlaE1vdmUpO1xuICAgICAgICB0aGlzLmNhbGxPbkVuZCgpO1xuICAgICAgfSxcblxuICAgICAgb25UaWNrQ2xpY2s6IGZ1bmN0aW9uKHBvaW50ZXIsIGV2ZW50KSB7XG4gICAgICAgIHRoaXMub25Nb3ZlKHBvaW50ZXIsIGV2ZW50LCB0cnVlKTtcbiAgICAgIH0sXG5cbiAgICAgIG9uUG9pbnRlckZvY3VzOiBmdW5jdGlvbihwb2ludGVyLCByZWYpIHtcbiAgICAgICAgdGhpcy50cmFja2luZyA9IHJlZjtcbiAgICAgICAgcG9pbnRlci5vbmUoJ2JsdXInLCBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vblBvaW50ZXJCbHVyLCBwb2ludGVyKSk7XG4gICAgICAgIHBvaW50ZXIub24oJ2tleWRvd24nLCBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vbktleWJvYXJkRXZlbnQpKTtcbiAgICAgICAgcG9pbnRlci5vbigna2V5dXAnLCBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vbktleVVwKSk7XG4gICAgICAgIHRoaXMuZmlyc3RLZXlEb3duID0gdHJ1ZTtcbiAgICAgICAgcG9pbnRlci5hZGRDbGFzcygncnotYWN0aXZlJyk7XG5cbiAgICAgICAgdGhpcy5jdXJyZW50Rm9jdXNFbGVtZW50ID0ge1xuICAgICAgICAgIHBvaW50ZXI6IHBvaW50ZXIsXG4gICAgICAgICAgcmVmOiByZWZcbiAgICAgICAgfTtcbiAgICAgIH0sXG5cbiAgICAgIG9uS2V5VXA6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmZpcnN0S2V5RG93biA9IHRydWU7XG4gICAgICAgIHRoaXMuY2FsbE9uRW5kKCk7XG4gICAgICB9LFxuXG4gICAgICBvblBvaW50ZXJCbHVyOiBmdW5jdGlvbihwb2ludGVyKSB7XG4gICAgICAgIHBvaW50ZXIub2ZmKCdrZXlkb3duJyk7XG4gICAgICAgIHBvaW50ZXIub2ZmKCdrZXl1cCcpO1xuICAgICAgICB0aGlzLnRyYWNraW5nID0gJyc7XG4gICAgICAgIHBvaW50ZXIucmVtb3ZlQ2xhc3MoJ3J6LWFjdGl2ZScpO1xuICAgICAgICB0aGlzLmN1cnJlbnRGb2N1c0VsZW1lbnQgPSBudWxsXG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEtleSBhY3Rpb25zIGhlbHBlciBmdW5jdGlvblxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjdXJyZW50VmFsdWUgdmFsdWUgb2YgdGhlIHNsaWRlclxuICAgICAgICpcbiAgICAgICAqIEByZXR1cm5zIHs/T2JqZWN0fSBhY3Rpb24gdmFsdWUgbWFwcGluZ3NcbiAgICAgICAqL1xuICAgICAgZ2V0S2V5QWN0aW9uczogZnVuY3Rpb24oY3VycmVudFZhbHVlKSB7XG4gICAgICAgIHZhciBpbmNyZWFzZVN0ZXAgPSBjdXJyZW50VmFsdWUgKyB0aGlzLnN0ZXAsXG4gICAgICAgICAgZGVjcmVhc2VTdGVwID0gY3VycmVudFZhbHVlIC0gdGhpcy5zdGVwLFxuICAgICAgICAgIGluY3JlYXNlUGFnZSA9IGN1cnJlbnRWYWx1ZSArIHRoaXMudmFsdWVSYW5nZSAvIDEwLFxuICAgICAgICAgIGRlY3JlYXNlUGFnZSA9IGN1cnJlbnRWYWx1ZSAtIHRoaXMudmFsdWVSYW5nZSAvIDEwO1xuXG4gICAgICAgIC8vTGVmdCB0byByaWdodCBkZWZhdWx0IGFjdGlvbnNcbiAgICAgICAgdmFyIGFjdGlvbnMgPSB7XG4gICAgICAgICAgJ1VQJzogaW5jcmVhc2VTdGVwLFxuICAgICAgICAgICdET1dOJzogZGVjcmVhc2VTdGVwLFxuICAgICAgICAgICdMRUZUJzogZGVjcmVhc2VTdGVwLFxuICAgICAgICAgICdSSUdIVCc6IGluY3JlYXNlU3RlcCxcbiAgICAgICAgICAnUEFHRVVQJzogaW5jcmVhc2VQYWdlLFxuICAgICAgICAgICdQQUdFRE9XTic6IGRlY3JlYXNlUGFnZSxcbiAgICAgICAgICAnSE9NRSc6IHRoaXMubWluVmFsdWUsXG4gICAgICAgICAgJ0VORCc6IHRoaXMubWF4VmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgLy9yaWdodCB0byBsZWZ0IG1lYW5zIHN3YXBwaW5nIHJpZ2h0IGFuZCBsZWZ0IGFycm93c1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJpZ2h0VG9MZWZ0KSB7XG4gICAgICAgICAgYWN0aW9ucy5MRUZUID0gaW5jcmVhc2VTdGVwO1xuICAgICAgICAgIGFjdGlvbnMuUklHSFQgPSBkZWNyZWFzZVN0ZXA7XG4gICAgICAgICAgLy8gcmlnaHQgdG8gbGVmdCBhbmQgdmVydGljYWwgbWVhbnMgd2UgYWxzbyBzd2FwIHVwIGFuZCBkb3duXG4gICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy52ZXJ0aWNhbCkge1xuICAgICAgICAgICAgYWN0aW9ucy5VUCA9IGRlY3JlYXNlU3RlcDtcbiAgICAgICAgICAgIGFjdGlvbnMuRE9XTiA9IGluY3JlYXNlU3RlcDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFjdGlvbnM7XG4gICAgICB9LFxuXG4gICAgICBvbktleWJvYXJkRXZlbnQ6IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIHZhciBjdXJyZW50VmFsdWUgPSB0aGlzW3RoaXMudHJhY2tpbmddLFxuICAgICAgICAgIGtleUNvZGUgPSBldmVudC5rZXlDb2RlIHx8IGV2ZW50LndoaWNoLFxuICAgICAgICAgIGtleXMgPSB7XG4gICAgICAgICAgICAzODogJ1VQJyxcbiAgICAgICAgICAgIDQwOiAnRE9XTicsXG4gICAgICAgICAgICAzNzogJ0xFRlQnLFxuICAgICAgICAgICAgMzk6ICdSSUdIVCcsXG4gICAgICAgICAgICAzMzogJ1BBR0VVUCcsXG4gICAgICAgICAgICAzNDogJ1BBR0VET1dOJyxcbiAgICAgICAgICAgIDM2OiAnSE9NRScsXG4gICAgICAgICAgICAzNTogJ0VORCdcbiAgICAgICAgICB9LFxuICAgICAgICAgIGFjdGlvbnMgPSB0aGlzLmdldEtleUFjdGlvbnMoY3VycmVudFZhbHVlKSxcbiAgICAgICAgICBrZXkgPSBrZXlzW2tleUNvZGVdLFxuICAgICAgICAgIGFjdGlvbiA9IGFjdGlvbnNba2V5XTtcbiAgICAgICAgaWYgKGFjdGlvbiA9PSBudWxsIHx8IHRoaXMudHJhY2tpbmcgPT09ICcnKSByZXR1cm47XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgaWYgKHRoaXMuZmlyc3RLZXlEb3duKSB7XG4gICAgICAgICAgdGhpcy5maXJzdEtleURvd24gPSBmYWxzZTtcbiAgICAgICAgICB0aGlzLmNhbGxPblN0YXJ0KCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICR0aW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBuZXdWYWx1ZSA9IHNlbGYucm91bmRTdGVwKHNlbGYuc2FuaXRpemVWYWx1ZShhY3Rpb24pKTtcbiAgICAgICAgICBpZiAoIXNlbGYub3B0aW9ucy5kcmFnZ2FibGVSYW5nZU9ubHkpIHtcbiAgICAgICAgICAgIHNlbGYucG9zaXRpb25UcmFja2luZ0hhbmRsZShuZXdWYWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIGRpZmZlcmVuY2UgPSBzZWxmLmhpZ2hWYWx1ZSAtIHNlbGYubG93VmFsdWUsXG4gICAgICAgICAgICAgIG5ld01pblZhbHVlLCBuZXdNYXhWYWx1ZTtcbiAgICAgICAgICAgIGlmIChzZWxmLnRyYWNraW5nID09PSAnbG93VmFsdWUnKSB7XG4gICAgICAgICAgICAgIG5ld01pblZhbHVlID0gbmV3VmFsdWU7XG4gICAgICAgICAgICAgIG5ld01heFZhbHVlID0gbmV3VmFsdWUgKyBkaWZmZXJlbmNlO1xuICAgICAgICAgICAgICBpZiAobmV3TWF4VmFsdWUgPiBzZWxmLm1heFZhbHVlKSB7XG4gICAgICAgICAgICAgICAgbmV3TWF4VmFsdWUgPSBzZWxmLm1heFZhbHVlO1xuICAgICAgICAgICAgICAgIG5ld01pblZhbHVlID0gbmV3TWF4VmFsdWUgLSBkaWZmZXJlbmNlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBuZXdNYXhWYWx1ZSA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgICBuZXdNaW5WYWx1ZSA9IG5ld1ZhbHVlIC0gZGlmZmVyZW5jZTtcbiAgICAgICAgICAgICAgaWYgKG5ld01pblZhbHVlIDwgc2VsZi5taW5WYWx1ZSkge1xuICAgICAgICAgICAgICAgIG5ld01pblZhbHVlID0gc2VsZi5taW5WYWx1ZTtcbiAgICAgICAgICAgICAgICBuZXdNYXhWYWx1ZSA9IG5ld01pblZhbHVlICsgZGlmZmVyZW5jZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2VsZi5wb3NpdGlvblRyYWNraW5nQmFyKG5ld01pblZhbHVlLCBuZXdNYXhWYWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogb25EcmFnU3RhcnQgZXZlbnQgaGFuZGxlclxuICAgICAgICpcbiAgICAgICAqIEhhbmRsZXMgZHJhZ2dpbmcgb2YgdGhlIG1pZGRsZSBiYXIuXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvaW50ZXIgVGhlIGpxTGl0ZSB3cmFwcGVkIERPTSBlbGVtZW50XG4gICAgICAgKiBAcGFyYW0ge3N0cmluZ30gcmVmICAgICBPbmUgb2YgdGhlIHJlZkxvdywgcmVmSGlnaCB2YWx1ZXNcbiAgICAgICAqIEBwYXJhbSB7RXZlbnR9ICBldmVudCAgIFRoZSBldmVudFxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgb25EcmFnU3RhcnQ6IGZ1bmN0aW9uKHBvaW50ZXIsIHJlZiwgZXZlbnQpIHtcbiAgICAgICAgdmFyIHBvc2l0aW9uID0gdGhpcy5nZXRFdmVudFBvc2l0aW9uKGV2ZW50KTtcbiAgICAgICAgdGhpcy5kcmFnZ2luZyA9IHtcbiAgICAgICAgICBhY3RpdmU6IHRydWUsXG4gICAgICAgICAgdmFsdWU6IHRoaXMucG9zaXRpb25Ub1ZhbHVlKHBvc2l0aW9uKSxcbiAgICAgICAgICBkaWZmZXJlbmNlOiB0aGlzLmhpZ2hWYWx1ZSAtIHRoaXMubG93VmFsdWUsXG4gICAgICAgICAgbG93TGltaXQ6IHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdCA/IHRoaXMubWluSC5yenNwIC0gcG9zaXRpb24gOiBwb3NpdGlvbiAtIHRoaXMubWluSC5yenNwLFxuICAgICAgICAgIGhpZ2hMaW1pdDogdGhpcy5vcHRpb25zLnJpZ2h0VG9MZWZ0ID8gcG9zaXRpb24gLSB0aGlzLm1heEgucnpzcCA6IHRoaXMubWF4SC5yenNwIC0gcG9zaXRpb25cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLm9uU3RhcnQocG9pbnRlciwgcmVmLCBldmVudCk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIGdldFZhbHVlIGhlbHBlciBmdW5jdGlvblxuICAgICAgICpcbiAgICAgICAqIGdldHMgbWF4IG9yIG1pbiB2YWx1ZSBkZXBlbmRpbmcgb24gd2hldGhlciB0aGUgbmV3UG9zIGlzIG91dE9mQm91bmRzIGFib3ZlIG9yIGJlbG93IHRoZSBiYXIgYW5kIHJpZ2h0VG9MZWZ0XG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgJ21heCcgfHwgJ21pbicgVGhlIHZhbHVlIHdlIGFyZSBjYWxjdWxhdGluZ1xuICAgICAgICogQHBhcmFtIHtudW1iZXJ9IG5ld1BvcyAgVGhlIG5ldyBwb3NpdGlvblxuICAgICAgICogQHBhcmFtIHtib29sZWFufSBvdXRPZkJvdW5kcyBJcyB0aGUgbmV3IHBvc2l0aW9uIGFib3ZlIG9yIGJlbG93IHRoZSBtYXgvbWluP1xuICAgICAgICogQHBhcmFtIHtib29sZWFufSBpc0Fib3ZlIElzIHRoZSBuZXcgcG9zaXRpb24gYWJvdmUgdGhlIGJhciBpZiBvdXQgb2YgYm91bmRzP1xuICAgICAgICpcbiAgICAgICAqIEByZXR1cm5zIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIGdldFZhbHVlOiBmdW5jdGlvbih0eXBlLCBuZXdQb3MsIG91dE9mQm91bmRzLCBpc0Fib3ZlKSB7XG4gICAgICAgIHZhciBpc1JUTCA9IHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdCxcbiAgICAgICAgICB2YWx1ZSA9IG51bGw7XG5cbiAgICAgICAgaWYgKHR5cGUgPT09ICdtaW4nKSB7XG4gICAgICAgICAgaWYgKG91dE9mQm91bmRzKSB7XG4gICAgICAgICAgICBpZiAoaXNBYm92ZSkge1xuICAgICAgICAgICAgICB2YWx1ZSA9IGlzUlRMID8gdGhpcy5taW5WYWx1ZSA6IHRoaXMubWF4VmFsdWUgLSB0aGlzLmRyYWdnaW5nLmRpZmZlcmVuY2U7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB2YWx1ZSA9IGlzUlRMID8gdGhpcy5tYXhWYWx1ZSAtIHRoaXMuZHJhZ2dpbmcuZGlmZmVyZW5jZSA6IHRoaXMubWluVmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhbHVlID0gaXNSVEwgPyB0aGlzLnBvc2l0aW9uVG9WYWx1ZShuZXdQb3MgKyB0aGlzLmRyYWdnaW5nLmxvd0xpbWl0KSA6IHRoaXMucG9zaXRpb25Ub1ZhbHVlKG5ld1BvcyAtIHRoaXMuZHJhZ2dpbmcubG93TGltaXQpXG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChvdXRPZkJvdW5kcykge1xuICAgICAgICAgICAgaWYgKGlzQWJvdmUpIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSBpc1JUTCA/IHRoaXMubWluVmFsdWUgKyB0aGlzLmRyYWdnaW5nLmRpZmZlcmVuY2UgOiB0aGlzLm1heFZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSBpc1JUTCA/IHRoaXMubWF4VmFsdWUgOiB0aGlzLm1pblZhbHVlICsgdGhpcy5kcmFnZ2luZy5kaWZmZXJlbmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoaXNSVEwpIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSB0aGlzLnBvc2l0aW9uVG9WYWx1ZShuZXdQb3MgKyB0aGlzLmRyYWdnaW5nLmxvd0xpbWl0KSArIHRoaXMuZHJhZ2dpbmcuZGlmZmVyZW5jZVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSB0aGlzLnBvc2l0aW9uVG9WYWx1ZShuZXdQb3MgLSB0aGlzLmRyYWdnaW5nLmxvd0xpbWl0KSArIHRoaXMuZHJhZ2dpbmcuZGlmZmVyZW5jZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMucm91bmRTdGVwKHZhbHVlKTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogb25EcmFnTW92ZSBldmVudCBoYW5kbGVyXG4gICAgICAgKlxuICAgICAgICogSGFuZGxlcyBkcmFnZ2luZyBvZiB0aGUgbWlkZGxlIGJhci5cbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0ge2pxTGl0ZX0gcG9pbnRlclxuICAgICAgICogQHBhcmFtIHtFdmVudH0gIGV2ZW50IFRoZSBldmVudFxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgb25EcmFnTW92ZTogZnVuY3Rpb24ocG9pbnRlciwgZXZlbnQpIHtcbiAgICAgICAgdmFyIG5ld1BvcyA9IHRoaXMuZ2V0RXZlbnRQb3NpdGlvbihldmVudCksXG4gICAgICAgICAgbmV3TWluVmFsdWUsIG5ld01heFZhbHVlLFxuICAgICAgICAgIGNlaWxMaW1pdCwgZmxyTGltaXQsXG4gICAgICAgICAgaXNVbmRlckZsckxpbWl0LCBpc092ZXJDZWlsTGltaXQsXG4gICAgICAgICAgZmxySCwgY2VpbEg7XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdCkge1xuICAgICAgICAgIGNlaWxMaW1pdCA9IHRoaXMuZHJhZ2dpbmcubG93TGltaXQ7XG4gICAgICAgICAgZmxyTGltaXQgPSB0aGlzLmRyYWdnaW5nLmhpZ2hMaW1pdDtcbiAgICAgICAgICBmbHJIID0gdGhpcy5tYXhIO1xuICAgICAgICAgIGNlaWxIID0gdGhpcy5taW5IO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNlaWxMaW1pdCA9IHRoaXMuZHJhZ2dpbmcuaGlnaExpbWl0O1xuICAgICAgICAgIGZsckxpbWl0ID0gdGhpcy5kcmFnZ2luZy5sb3dMaW1pdDtcbiAgICAgICAgICBmbHJIID0gdGhpcy5taW5IO1xuICAgICAgICAgIGNlaWxIID0gdGhpcy5tYXhIO1xuICAgICAgICB9XG4gICAgICAgIGlzVW5kZXJGbHJMaW1pdCA9IG5ld1BvcyA8PSBmbHJMaW1pdDtcbiAgICAgICAgaXNPdmVyQ2VpbExpbWl0ID0gbmV3UG9zID49IHRoaXMubWF4UG9zIC0gY2VpbExpbWl0O1xuXG4gICAgICAgIGlmIChpc1VuZGVyRmxyTGltaXQpIHtcbiAgICAgICAgICBpZiAoZmxySC5yenNwID09PSAwKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIG5ld01pblZhbHVlID0gdGhpcy5nZXRWYWx1ZSgnbWluJywgbmV3UG9zLCB0cnVlLCBmYWxzZSk7XG4gICAgICAgICAgbmV3TWF4VmFsdWUgPSB0aGlzLmdldFZhbHVlKCdtYXgnLCBuZXdQb3MsIHRydWUsIGZhbHNlKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc092ZXJDZWlsTGltaXQpIHtcbiAgICAgICAgICBpZiAoY2VpbEgucnpzcCA9PT0gdGhpcy5tYXhQb3MpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgbmV3TWF4VmFsdWUgPSB0aGlzLmdldFZhbHVlKCdtYXgnLCBuZXdQb3MsIHRydWUsIHRydWUpO1xuICAgICAgICAgIG5ld01pblZhbHVlID0gdGhpcy5nZXRWYWx1ZSgnbWluJywgbmV3UG9zLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdNaW5WYWx1ZSA9IHRoaXMuZ2V0VmFsdWUoJ21pbicsIG5ld1BvcywgZmFsc2UpO1xuICAgICAgICAgIG5ld01heFZhbHVlID0gdGhpcy5nZXRWYWx1ZSgnbWF4JywgbmV3UG9zLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wb3NpdGlvblRyYWNraW5nQmFyKG5ld01pblZhbHVlLCBuZXdNYXhWYWx1ZSk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFNldCB0aGUgbmV3IHZhbHVlIGFuZCBwb3NpdGlvbiBmb3IgdGhlIGVudGlyZSBiYXJcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0ge251bWJlcn0gbmV3TWluVmFsdWUgICB0aGUgbmV3IG1pbmltdW0gdmFsdWVcbiAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuZXdNYXhWYWx1ZSAgIHRoZSBuZXcgbWF4aW11bSB2YWx1ZVxuICAgICAgICovXG4gICAgICBwb3NpdGlvblRyYWNraW5nQmFyOiBmdW5jdGlvbihuZXdNaW5WYWx1ZSwgbmV3TWF4VmFsdWUpIHtcblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLm1pbkxpbWl0ICE9IG51bGwgJiYgbmV3TWluVmFsdWUgPCB0aGlzLm9wdGlvbnMubWluTGltaXQpIHtcbiAgICAgICAgICBuZXdNaW5WYWx1ZSA9IHRoaXMub3B0aW9ucy5taW5MaW1pdDtcbiAgICAgICAgICBuZXdNYXhWYWx1ZSA9IG5ld01pblZhbHVlICsgdGhpcy5kcmFnZ2luZy5kaWZmZXJlbmNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMubWF4TGltaXQgIT0gbnVsbCAmJiBuZXdNYXhWYWx1ZSA+IHRoaXMub3B0aW9ucy5tYXhMaW1pdCkge1xuICAgICAgICAgIG5ld01heFZhbHVlID0gdGhpcy5vcHRpb25zLm1heExpbWl0O1xuICAgICAgICAgIG5ld01pblZhbHVlID0gbmV3TWF4VmFsdWUgLSB0aGlzLmRyYWdnaW5nLmRpZmZlcmVuY2U7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxvd1ZhbHVlID0gbmV3TWluVmFsdWU7XG4gICAgICAgIHRoaXMuaGlnaFZhbHVlID0gbmV3TWF4VmFsdWU7XG4gICAgICAgIHRoaXMuYXBwbHlMb3dWYWx1ZSgpO1xuICAgICAgICBpZiAodGhpcy5yYW5nZSlcbiAgICAgICAgICB0aGlzLmFwcGx5SGlnaFZhbHVlKCk7XG4gICAgICAgIHRoaXMuYXBwbHlNb2RlbCgpO1xuICAgICAgICB0aGlzLnVwZGF0ZUhhbmRsZXMoJ2xvd1ZhbHVlJywgdGhpcy52YWx1ZVRvUG9zaXRpb24obmV3TWluVmFsdWUpKTtcbiAgICAgICAgdGhpcy51cGRhdGVIYW5kbGVzKCdoaWdoVmFsdWUnLCB0aGlzLnZhbHVlVG9Qb3NpdGlvbihuZXdNYXhWYWx1ZSkpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBTZXQgdGhlIG5ldyB2YWx1ZSBhbmQgcG9zaXRpb24gdG8gdGhlIGN1cnJlbnQgdHJhY2tpbmcgaGFuZGxlXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtudW1iZXJ9IG5ld1ZhbHVlIG5ldyBtb2RlbCB2YWx1ZVxuICAgICAgICovXG4gICAgICBwb3NpdGlvblRyYWNraW5nSGFuZGxlOiBmdW5jdGlvbihuZXdWYWx1ZSkge1xuICAgICAgICB2YXIgdmFsdWVDaGFuZ2VkID0gZmFsc2U7XG5cbiAgICAgICAgbmV3VmFsdWUgPSB0aGlzLmFwcGx5TWluTWF4TGltaXQobmV3VmFsdWUpO1xuICAgICAgICBpZiAodGhpcy5yYW5nZSkge1xuICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMucHVzaFJhbmdlKSB7XG4gICAgICAgICAgICBuZXdWYWx1ZSA9IHRoaXMuYXBwbHlQdXNoUmFuZ2UobmV3VmFsdWUpO1xuICAgICAgICAgICAgdmFsdWVDaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLm5vU3dpdGNoaW5nKSB7XG4gICAgICAgICAgICAgIGlmICh0aGlzLnRyYWNraW5nID09PSAnbG93VmFsdWUnICYmIG5ld1ZhbHVlID4gdGhpcy5oaWdoVmFsdWUpXG4gICAgICAgICAgICAgICAgbmV3VmFsdWUgPSB0aGlzLmFwcGx5TWluTWF4UmFuZ2UodGhpcy5oaWdoVmFsdWUpO1xuICAgICAgICAgICAgICBlbHNlIGlmICh0aGlzLnRyYWNraW5nID09PSAnaGlnaFZhbHVlJyAmJiBuZXdWYWx1ZSA8IHRoaXMubG93VmFsdWUpXG4gICAgICAgICAgICAgICAgbmV3VmFsdWUgPSB0aGlzLmFwcGx5TWluTWF4UmFuZ2UodGhpcy5sb3dWYWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuZXdWYWx1ZSA9IHRoaXMuYXBwbHlNaW5NYXhSYW5nZShuZXdWYWx1ZSk7XG4gICAgICAgICAgICAvKiBUaGlzIGlzIHRvIGNoZWNrIGlmIHdlIG5lZWQgdG8gc3dpdGNoIHRoZSBtaW4gYW5kIG1heCBoYW5kbGVzICovXG4gICAgICAgICAgICBpZiAodGhpcy50cmFja2luZyA9PT0gJ2xvd1ZhbHVlJyAmJiBuZXdWYWx1ZSA+IHRoaXMuaGlnaFZhbHVlKSB7XG4gICAgICAgICAgICAgIHRoaXMubG93VmFsdWUgPSB0aGlzLmhpZ2hWYWx1ZTtcbiAgICAgICAgICAgICAgdGhpcy5hcHBseUxvd1ZhbHVlKCk7XG4gICAgICAgICAgICAgIHRoaXMudXBkYXRlSGFuZGxlcyh0aGlzLnRyYWNraW5nLCB0aGlzLm1heEgucnpzcCk7XG4gICAgICAgICAgICAgIHRoaXMudXBkYXRlQXJpYUF0dHJpYnV0ZXMoKTtcbiAgICAgICAgICAgICAgdGhpcy50cmFja2luZyA9ICdoaWdoVmFsdWUnO1xuICAgICAgICAgICAgICB0aGlzLm1pbkgucmVtb3ZlQ2xhc3MoJ3J6LWFjdGl2ZScpO1xuICAgICAgICAgICAgICB0aGlzLm1heEguYWRkQ2xhc3MoJ3J6LWFjdGl2ZScpO1xuICAgICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLmtleWJvYXJkU3VwcG9ydClcbiAgICAgICAgICAgICAgICB0aGlzLmZvY3VzRWxlbWVudCh0aGlzLm1heEgpO1xuICAgICAgICAgICAgICB2YWx1ZUNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy50cmFja2luZyA9PT0gJ2hpZ2hWYWx1ZScgJiYgbmV3VmFsdWUgPCB0aGlzLmxvd1ZhbHVlKSB7XG4gICAgICAgICAgICAgIHRoaXMuaGlnaFZhbHVlID0gdGhpcy5sb3dWYWx1ZTtcbiAgICAgICAgICAgICAgdGhpcy5hcHBseUhpZ2hWYWx1ZSgpO1xuICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUhhbmRsZXModGhpcy50cmFja2luZywgdGhpcy5taW5ILnJ6c3ApO1xuICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUFyaWFBdHRyaWJ1dGVzKCk7XG4gICAgICAgICAgICAgIHRoaXMudHJhY2tpbmcgPSAnbG93VmFsdWUnO1xuICAgICAgICAgICAgICB0aGlzLm1heEgucmVtb3ZlQ2xhc3MoJ3J6LWFjdGl2ZScpO1xuICAgICAgICAgICAgICB0aGlzLm1pbkguYWRkQ2xhc3MoJ3J6LWFjdGl2ZScpO1xuICAgICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLmtleWJvYXJkU3VwcG9ydClcbiAgICAgICAgICAgICAgICB0aGlzLmZvY3VzRWxlbWVudCh0aGlzLm1pbkgpO1xuICAgICAgICAgICAgICB2YWx1ZUNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzW3RoaXMudHJhY2tpbmddICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgIHRoaXNbdGhpcy50cmFja2luZ10gPSBuZXdWYWx1ZTtcbiAgICAgICAgICBpZiAodGhpcy50cmFja2luZyA9PT0gJ2xvd1ZhbHVlJylcbiAgICAgICAgICAgIHRoaXMuYXBwbHlMb3dWYWx1ZSgpO1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMuYXBwbHlIaWdoVmFsdWUoKTtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUhhbmRsZXModGhpcy50cmFja2luZywgdGhpcy52YWx1ZVRvUG9zaXRpb24obmV3VmFsdWUpKTtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUFyaWFBdHRyaWJ1dGVzKCk7XG4gICAgICAgICAgdmFsdWVDaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZUNoYW5nZWQpXG4gICAgICAgICAgdGhpcy5hcHBseU1vZGVsKCk7XG4gICAgICB9LFxuXG4gICAgICBhcHBseU1pbk1heExpbWl0OiBmdW5jdGlvbihuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLm1pbkxpbWl0ICE9IG51bGwgJiYgbmV3VmFsdWUgPCB0aGlzLm9wdGlvbnMubWluTGltaXQpXG4gICAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5taW5MaW1pdDtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5tYXhMaW1pdCAhPSBudWxsICYmIG5ld1ZhbHVlID4gdGhpcy5vcHRpb25zLm1heExpbWl0KVxuICAgICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMubWF4TGltaXQ7XG4gICAgICAgIHJldHVybiBuZXdWYWx1ZTtcbiAgICAgIH0sXG5cbiAgICAgIGFwcGx5TWluTWF4UmFuZ2U6IGZ1bmN0aW9uKG5ld1ZhbHVlKSB7XG4gICAgICAgIHZhciBvcHBvc2l0ZVZhbHVlID0gdGhpcy50cmFja2luZyA9PT0gJ2xvd1ZhbHVlJyA/IHRoaXMuaGlnaFZhbHVlIDogdGhpcy5sb3dWYWx1ZSxcbiAgICAgICAgICBkaWZmZXJlbmNlID0gTWF0aC5hYnMobmV3VmFsdWUgLSBvcHBvc2l0ZVZhbHVlKTtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5taW5SYW5nZSAhPSBudWxsKSB7XG4gICAgICAgICAgaWYgKGRpZmZlcmVuY2UgPCB0aGlzLm9wdGlvbnMubWluUmFuZ2UpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnRyYWNraW5nID09PSAnbG93VmFsdWUnKVxuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5oaWdoVmFsdWUgLSB0aGlzLm9wdGlvbnMubWluUmFuZ2U7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLmxvd1ZhbHVlICsgdGhpcy5vcHRpb25zLm1pblJhbmdlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLm1heFJhbmdlICE9IG51bGwpIHtcbiAgICAgICAgICBpZiAoZGlmZmVyZW5jZSA+IHRoaXMub3B0aW9ucy5tYXhSYW5nZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMudHJhY2tpbmcgPT09ICdsb3dWYWx1ZScpXG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLmhpZ2hWYWx1ZSAtIHRoaXMub3B0aW9ucy5tYXhSYW5nZTtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubG93VmFsdWUgKyB0aGlzLm9wdGlvbnMubWF4UmFuZ2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXdWYWx1ZTtcbiAgICAgIH0sXG5cbiAgICAgIGFwcGx5UHVzaFJhbmdlOiBmdW5jdGlvbihuZXdWYWx1ZSkge1xuICAgICAgICB2YXIgZGlmZmVyZW5jZSA9IHRoaXMudHJhY2tpbmcgPT09ICdsb3dWYWx1ZScgPyB0aGlzLmhpZ2hWYWx1ZSAtIG5ld1ZhbHVlIDogbmV3VmFsdWUgLSB0aGlzLmxvd1ZhbHVlLFxuICAgICAgICAgIG1pblJhbmdlID0gdGhpcy5vcHRpb25zLm1pblJhbmdlICE9PSBudWxsID8gdGhpcy5vcHRpb25zLm1pblJhbmdlIDogdGhpcy5vcHRpb25zLnN0ZXAsXG4gICAgICAgICAgbWF4UmFuZ2UgPSB0aGlzLm9wdGlvbnMubWF4UmFuZ2U7XG4gICAgICAgIC8vIGlmIHNtYWxsZXIgdGhhbiBtaW5SYW5nZVxuICAgICAgICBpZiAoZGlmZmVyZW5jZSA8IG1pblJhbmdlKSB7XG4gICAgICAgICAgaWYgKHRoaXMudHJhY2tpbmcgPT09ICdsb3dWYWx1ZScpIHtcbiAgICAgICAgICAgIHRoaXMuaGlnaFZhbHVlID0gTWF0aC5taW4obmV3VmFsdWUgKyBtaW5SYW5nZSwgdGhpcy5tYXhWYWx1ZSk7XG4gICAgICAgICAgICBuZXdWYWx1ZSA9IHRoaXMuaGlnaFZhbHVlIC0gbWluUmFuZ2U7XG4gICAgICAgICAgICB0aGlzLmFwcGx5SGlnaFZhbHVlKCk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUhhbmRsZXMoJ2hpZ2hWYWx1ZScsIHRoaXMudmFsdWVUb1Bvc2l0aW9uKHRoaXMuaGlnaFZhbHVlKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5sb3dWYWx1ZSA9IE1hdGgubWF4KG5ld1ZhbHVlIC0gbWluUmFuZ2UsIHRoaXMubWluVmFsdWUpO1xuICAgICAgICAgICAgbmV3VmFsdWUgPSB0aGlzLmxvd1ZhbHVlICsgbWluUmFuZ2U7XG4gICAgICAgICAgICB0aGlzLmFwcGx5TG93VmFsdWUoKTtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlSGFuZGxlcygnbG93VmFsdWUnLCB0aGlzLnZhbHVlVG9Qb3NpdGlvbih0aGlzLmxvd1ZhbHVlKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMudXBkYXRlQXJpYUF0dHJpYnV0ZXMoKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiBncmVhdGVyIHRoYW4gbWF4UmFuZ2VcbiAgICAgICAgZWxzZSBpZiAobWF4UmFuZ2UgIT09IG51bGwgJiYgZGlmZmVyZW5jZSA+IG1heFJhbmdlKSB7XG4gICAgICAgICAgaWYgKHRoaXMudHJhY2tpbmcgPT09ICdsb3dWYWx1ZScpIHtcbiAgICAgICAgICAgIHRoaXMuaGlnaFZhbHVlID0gbmV3VmFsdWUgKyBtYXhSYW5nZTtcbiAgICAgICAgICAgIHRoaXMuYXBwbHlIaWdoVmFsdWUoKTtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlSGFuZGxlcygnaGlnaFZhbHVlJywgdGhpcy52YWx1ZVRvUG9zaXRpb24odGhpcy5oaWdoVmFsdWUpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxvd1ZhbHVlID0gbmV3VmFsdWUgLSBtYXhSYW5nZTtcbiAgICAgICAgICAgIHRoaXMuYXBwbHlMb3dWYWx1ZSgpO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVIYW5kbGVzKCdsb3dWYWx1ZScsIHRoaXMudmFsdWVUb1Bvc2l0aW9uKHRoaXMubG93VmFsdWUpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy51cGRhdGVBcmlhQXR0cmlidXRlcygpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXdWYWx1ZTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQXBwbHkgdGhlIG1vZGVsIHZhbHVlcyB1c2luZyBzY29wZS4kYXBwbHkuXG4gICAgICAgKiBXZSB3cmFwIGl0IHdpdGggdGhlIGludGVybmFsQ2hhbmdlIGZsYWcgdG8gYXZvaWQgdGhlIHdhdGNoZXJzIHRvIGJlIGNhbGxlZFxuICAgICAgICovXG4gICAgICBhcHBseU1vZGVsOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5pbnRlcm5hbENoYW5nZSA9IHRydWU7XG4gICAgICAgIHRoaXMuc2NvcGUuJGFwcGx5KCk7XG4gICAgICAgIHRoaXMuY2FsbE9uQ2hhbmdlKCk7XG4gICAgICAgIHRoaXMuaW50ZXJuYWxDaGFuZ2UgPSBmYWxzZTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQ2FsbCB0aGUgb25TdGFydCBjYWxsYmFjayBpZiBkZWZpbmVkXG4gICAgICAgKiBUaGUgY2FsbGJhY2sgY2FsbCBpcyB3cmFwcGVkIGluIGEgJGV2YWxBc3luYyB0byBlbnN1cmUgdGhhdCBpdHMgcmVzdWx0IHdpbGwgYmUgYXBwbGllZCB0byB0aGUgc2NvcGUuXG4gICAgICAgKlxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgY2FsbE9uU3RhcnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLm9uU3RhcnQpIHtcbiAgICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgICAgICBwb2ludGVyVHlwZSA9IHRoaXMudHJhY2tpbmcgPT09ICdsb3dWYWx1ZScgPyAnbWluJyA6ICdtYXgnO1xuICAgICAgICAgIHRoaXMuc2NvcGUuJGV2YWxBc3luYyhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNlbGYub3B0aW9ucy5vblN0YXJ0KHNlbGYub3B0aW9ucy5pZCwgc2VsZi5zY29wZS5yelNsaWRlck1vZGVsLCBzZWxmLnNjb3BlLnJ6U2xpZGVySGlnaCwgcG9pbnRlclR5cGUpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIENhbGwgdGhlIG9uQ2hhbmdlIGNhbGxiYWNrIGlmIGRlZmluZWRcbiAgICAgICAqIFRoZSBjYWxsYmFjayBjYWxsIGlzIHdyYXBwZWQgaW4gYSAkZXZhbEFzeW5jIHRvIGVuc3VyZSB0aGF0IGl0cyByZXN1bHQgd2lsbCBiZSBhcHBsaWVkIHRvIHRoZSBzY29wZS5cbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgICAgICovXG4gICAgICBjYWxsT25DaGFuZ2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLm9uQ2hhbmdlKSB7XG4gICAgICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICAgICAgcG9pbnRlclR5cGUgPSB0aGlzLnRyYWNraW5nID09PSAnbG93VmFsdWUnID8gJ21pbicgOiAnbWF4JztcbiAgICAgICAgICB0aGlzLnNjb3BlLiRldmFsQXN5bmMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzZWxmLm9wdGlvbnMub25DaGFuZ2Uoc2VsZi5vcHRpb25zLmlkLCBzZWxmLnNjb3BlLnJ6U2xpZGVyTW9kZWwsIHNlbGYuc2NvcGUucnpTbGlkZXJIaWdoLCBwb2ludGVyVHlwZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQ2FsbCB0aGUgb25FbmQgY2FsbGJhY2sgaWYgZGVmaW5lZFxuICAgICAgICogVGhlIGNhbGxiYWNrIGNhbGwgaXMgd3JhcHBlZCBpbiBhICRldmFsQXN5bmMgdG8gZW5zdXJlIHRoYXQgaXRzIHJlc3VsdCB3aWxsIGJlIGFwcGxpZWQgdG8gdGhlIHNjb3BlLlxuICAgICAgICpcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIGNhbGxPbkVuZDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMub25FbmQpIHtcbiAgICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgICAgICBwb2ludGVyVHlwZSA9IHRoaXMudHJhY2tpbmcgPT09ICdsb3dWYWx1ZScgPyAnbWluJyA6ICdtYXgnO1xuICAgICAgICAgIHRoaXMuc2NvcGUuJGV2YWxBc3luYyhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNlbGYub3B0aW9ucy5vbkVuZChzZWxmLm9wdGlvbnMuaWQsIHNlbGYuc2NvcGUucnpTbGlkZXJNb2RlbCwgc2VsZi5zY29wZS5yelNsaWRlckhpZ2gsIHBvaW50ZXJUeXBlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNjb3BlLiRlbWl0KCdzbGlkZUVuZGVkJyk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBTbGlkZXI7XG4gIH1dKVxuXG4gIC5kaXJlY3RpdmUoJ3J6c2xpZGVyJywgWydSelNsaWRlcicsIGZ1bmN0aW9uKFJ6U2xpZGVyKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHJlc3RyaWN0OiAnQUUnLFxuICAgICAgcmVwbGFjZTogdHJ1ZSxcbiAgICAgIHNjb3BlOiB7XG4gICAgICAgIHJ6U2xpZGVyTW9kZWw6ICc9PycsXG4gICAgICAgIHJ6U2xpZGVySGlnaDogJz0/JyxcbiAgICAgICAgcnpTbGlkZXJPcHRpb25zOiAnJj8nLFxuICAgICAgICByelNsaWRlclRwbFVybDogJ0AnXG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFJldHVybiB0ZW1wbGF0ZSBVUkxcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0ge2pxTGl0ZX0gZWxlbVxuICAgICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICAgKi9cbiAgICAgIHRlbXBsYXRlVXJsOiBmdW5jdGlvbihlbGVtLCBhdHRycykge1xuICAgICAgICAvL25vaW5zcGVjdGlvbiBKU1VucmVzb2x2ZWRWYXJpYWJsZVxuICAgICAgICByZXR1cm4gYXR0cnMucnpTbGlkZXJUcGxVcmwgfHwgJ3J6U2xpZGVyVHBsLmh0bWwnO1xuICAgICAgfSxcblxuICAgICAgbGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW0pIHtcbiAgICAgICAgc2NvcGUuc2xpZGVyID0gbmV3IFJ6U2xpZGVyKHNjb3BlLCBlbGVtKTsgLy9hdHRhY2ggb24gc2NvcGUgc28gd2UgY2FuIHRlc3QgaXRcbiAgICAgIH1cbiAgICB9O1xuICB9XSk7XG5cbiAgLy8gSURFIGFzc2lzdFxuXG4gIC8qKlxuICAgKiBAbmFtZSBuZ1Njb3BlXG4gICAqXG4gICAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByelNsaWRlck1vZGVsXG4gICAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByelNsaWRlckhpZ2hcbiAgICogQHByb3BlcnR5IHtPYmplY3R9IHJ6U2xpZGVyT3B0aW9uc1xuICAgKi9cblxuICAvKipcbiAgICogQG5hbWUganFMaXRlXG4gICAqXG4gICAqIEBwcm9wZXJ0eSB7bnVtYmVyfHVuZGVmaW5lZH0gcnpzcCByenNsaWRlciBsYWJlbCBwb3NpdGlvbiBwb3NpdGlvblxuICAgKiBAcHJvcGVydHkge251bWJlcnx1bmRlZmluZWR9IHJ6c2QgcnpzbGlkZXIgZWxlbWVudCBkaW1lbnNpb25cbiAgICogQHByb3BlcnR5IHtzdHJpbmd8dW5kZWZpbmVkfSByenN2IHJ6c2xpZGVyIGxhYmVsIHZhbHVlL3RleHRcbiAgICogQHByb3BlcnR5IHtGdW5jdGlvbn0gY3NzXG4gICAqIEBwcm9wZXJ0eSB7RnVuY3Rpb259IHRleHRcbiAgICovXG5cbiAgLyoqXG4gICAqIEBuYW1lIEV2ZW50XG4gICAqIEBwcm9wZXJ0eSB7QXJyYXl9IHRvdWNoZXNcbiAgICogQHByb3BlcnR5IHtFdmVudH0gb3JpZ2luYWxFdmVudFxuICAgKi9cblxuICAvKipcbiAgICogQG5hbWUgVGhyb3R0bGVPcHRpb25zXG4gICAqXG4gICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gbGVhZGluZ1xuICAgKiBAcHJvcGVydHkge2Jvb2xlYW59IHRyYWlsaW5nXG4gICAqL1xuXG4gIG1vZHVsZS5ydW4oWyckdGVtcGxhdGVDYWNoZScsIGZ1bmN0aW9uKCR0ZW1wbGF0ZUNhY2hlKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICAkdGVtcGxhdGVDYWNoZS5wdXQoJ3J6U2xpZGVyVHBsLmh0bWwnLFxuICAgIFwiPGRpdiBjbGFzcz1yenNsaWRlcj48c3BhbiBjbGFzcz1yei1iYXItd3JhcHBlcj48c3BhbiBjbGFzcz1yei1iYXI+PC9zcGFuPjwvc3Bhbj4gPHNwYW4gY2xhc3M9cnotYmFyLXdyYXBwZXI+PHNwYW4gY2xhc3M9XFxcInJ6LWJhciByei1zZWxlY3Rpb25cXFwiIG5nLXN0eWxlPWJhclN0eWxlPjwvc3Bhbj48L3NwYW4+IDxzcGFuIGNsYXNzPVxcXCJyei1wb2ludGVyIHJ6LXBvaW50ZXItbWluXFxcIiBuZy1zdHlsZT1taW5Qb2ludGVyU3R5bGU+PC9zcGFuPiA8c3BhbiBjbGFzcz1cXFwicnotcG9pbnRlciByei1wb2ludGVyLW1heFxcXCIgbmctc3R5bGU9bWF4UG9pbnRlclN0eWxlPjwvc3Bhbj4gPHNwYW4gY2xhc3M9XFxcInJ6LWJ1YmJsZSByei1saW1pdCByei1mbG9vclxcXCI+PC9zcGFuPiA8c3BhbiBjbGFzcz1cXFwicnotYnViYmxlIHJ6LWxpbWl0IHJ6LWNlaWxcXFwiPjwvc3Bhbj4gPHNwYW4gY2xhc3M9cnotYnViYmxlPjwvc3Bhbj4gPHNwYW4gY2xhc3M9cnotYnViYmxlPjwvc3Bhbj4gPHNwYW4gY2xhc3M9cnotYnViYmxlPjwvc3Bhbj48dWwgbmctc2hvdz1zaG93VGlja3MgY2xhc3M9cnotdGlja3M+PGxpIG5nLXJlcGVhdD1cXFwidCBpbiB0aWNrcyB0cmFjayBieSAkaW5kZXhcXFwiIGNsYXNzPXJ6LXRpY2sgbmctY2xhc3M9XFxcInsncnotc2VsZWN0ZWQnOiB0LnNlbGVjdGVkfVxcXCIgbmctc3R5bGU9dC5zdHlsZSBuZy1hdHRyLXVpYi10b29sdGlwPVxcXCJ7eyB0LnRvb2x0aXAgfX1cXFwiIG5nLWF0dHItdG9vbHRpcC1wbGFjZW1lbnQ9e3t0LnRvb2x0aXBQbGFjZW1lbnR9fSBuZy1hdHRyLXRvb2x0aXAtYXBwZW5kLXRvLWJvZHk9XFxcInt7IHQudG9vbHRpcCA/IHRydWUgOiB1bmRlZmluZWR9fVxcXCI+PHNwYW4gbmctaWY9XFxcInQudmFsdWUgIT0gbnVsbFxcXCIgY2xhc3M9cnotdGljay12YWx1ZSBuZy1hdHRyLXVpYi10b29sdGlwPVxcXCJ7eyB0LnZhbHVlVG9vbHRpcCB9fVxcXCIgbmctYXR0ci10b29sdGlwLXBsYWNlbWVudD17e3QudmFsdWVUb29sdGlwUGxhY2VtZW50fX0+e3sgdC52YWx1ZSB9fTwvc3Bhbj4gPHNwYW4gbmctaWY9XFxcInQubGVnZW5kICE9IG51bGxcXFwiIGNsYXNzPXJ6LXRpY2stbGVnZW5kPnt7IHQubGVnZW5kIH19PC9zcGFuPjwvbGk+PC91bD48L2Rpdj5cIlxuICApO1xuXG59XSk7XG5cbiAgcmV0dXJuIG1vZHVsZS5uYW1lXG59KSk7XG4iLCIvKipcbiAqIE1vdXNldHJhcCB3cmFwcGVyIGZvciBBbmd1bGFySlNcbiAqIEB2ZXJzaW9uIHYwLjAuMSAtIDIwMTMtMTItMzBcbiAqIEBsaW5rIGh0dHBzOi8vZ2l0aHViLmNvbS9tZ29udG8vbWdvLW1vdXNldHJhcFxuICogQGF1dGhvciBNYXJ0aW4gR29udG92bmlrYXMgPG1hcnRpbkBnb24udG8+XG4gKiBAbGljZW5zZSBNSVQgTGljZW5zZSwgaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVRcbiAqL1xuYW5ndWxhci5tb2R1bGUoJ21nby1tb3VzZXRyYXAnLCBbXSkuZGlyZWN0aXZlKCd3TW91c2V0cmFwJywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnQScsXG4gICAgICAgIGNvbnRyb2xsZXI6IFsnJHNjb3BlJywgJyRlbGVtZW50JywgJyRhdHRycycsXG4gICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiAoJHNjb3BlLCAkZWxlbWVudCwgJGF0dHJzKSB7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBtb3VzZXRyYXA7XG5cbiAgICAgICAgICAgICRzY29wZS4kd2F0Y2goJGF0dHJzLndNb3VzZXRyYXAsIGZ1bmN0aW9uKF9tb3VzZXRyYXApIHtcbiAgICAgICAgICAgICAgICBtb3VzZXRyYXAgPSBfbW91c2V0cmFwO1xuXG4gICAgICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIG1vdXNldHJhcCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAobW91c2V0cmFwLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIE1vdXNldHJhcC51bmJpbmQoa2V5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIE1vdXNldHJhcC5iaW5kKGtleSwgYXBwbHlXcmFwcGVyKG1vdXNldHJhcFtrZXldKSk7IFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgdHJ1ZSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZ1bmN0aW9uIGFwcGx5V3JhcHBlcihmdW5jKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgJHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmMoZSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgICRlbGVtZW50LmJpbmQoJyRkZXN0cm95JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFtb3VzZXRyYXApIHJldHVybjtcblxuICAgICAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBtb3VzZXRyYXApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1vdXNldHJhcC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBNb3VzZXRyYXAudW5iaW5kKGtleSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XVxuICAgIH1cbn0pO1xuIl19
