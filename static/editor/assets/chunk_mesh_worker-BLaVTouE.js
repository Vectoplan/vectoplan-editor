(function() {
	const J = "srgb", je = "srgb-linear", Xe = "linear", wi = "srgb";
	function zi(i) {
		for (let t = i.length - 1; t >= 0; --t) if (i[t] >= 65535) return !0;
		return !1;
	}
	function Si(i) {
		return ArrayBuffer.isView(i) && !(i instanceof DataView);
	}
	function Ze(i) {
		return document.createElementNS("http://www.w3.org/1999/xhtml", i);
	}
	const Ye = {};
	function He(i) {
		const t = i[0];
		if (typeof t == "string" && t.startsWith("TSL:")) {
			const e = i[1];
			e && e.isStackTrace ? i[0] += " " + e.getLocation() : i[1] = "Stack trace not available. Enable \"THREE.Node.captureStackTrace\" to capture stack traces.";
		}
		return i;
	}
	function F(...i) {
		i = He(i);
		const t = "THREE." + i.shift();
		{
			const e = i[0];
			e && e.isStackTrace ? console.warn(e.getError(t)) : console.warn(t, ...i);
		}
	}
	function E(...i) {
		i = He(i);
		const t = "THREE." + i.shift();
		{
			const e = i[0];
			e && e.isStackTrace ? console.error(e.getError(t)) : console.error(t, ...i);
		}
	}
	function Je(...i) {
		const t = i.join(" ");
		t in Ye || (Ye[t] = !0, F(...i));
	}
	var Lt = class {
		addEventListener(i, t) {
			this._listeners === void 0 && (this._listeners = {});
			const e = this._listeners;
			e[i] === void 0 && (e[i] = []), e[i].indexOf(t) === -1 && e[i].push(t);
		}
		hasEventListener(i, t) {
			const e = this._listeners;
			return e === void 0 ? !1 : e[i] !== void 0 && e[i].indexOf(t) !== -1;
		}
		removeEventListener(i, t) {
			const e = this._listeners;
			if (e === void 0) return;
			const s = e[i];
			if (s !== void 0) {
				const r = s.indexOf(t);
				r !== -1 && s.splice(r, 1);
			}
		}
		dispatchEvent(i) {
			const t = this._listeners;
			if (t === void 0) return;
			const e = t[i.type];
			if (e !== void 0) {
				i.target = this;
				const s = e.slice(0);
				for (let r = 0, n = s.length; r < n; r++) s[r].call(this, i);
				i.target = null;
			}
		}
	};
	const D = [
		"00",
		"01",
		"02",
		"03",
		"04",
		"05",
		"06",
		"07",
		"08",
		"09",
		"0a",
		"0b",
		"0c",
		"0d",
		"0e",
		"0f",
		"10",
		"11",
		"12",
		"13",
		"14",
		"15",
		"16",
		"17",
		"18",
		"19",
		"1a",
		"1b",
		"1c",
		"1d",
		"1e",
		"1f",
		"20",
		"21",
		"22",
		"23",
		"24",
		"25",
		"26",
		"27",
		"28",
		"29",
		"2a",
		"2b",
		"2c",
		"2d",
		"2e",
		"2f",
		"30",
		"31",
		"32",
		"33",
		"34",
		"35",
		"36",
		"37",
		"38",
		"39",
		"3a",
		"3b",
		"3c",
		"3d",
		"3e",
		"3f",
		"40",
		"41",
		"42",
		"43",
		"44",
		"45",
		"46",
		"47",
		"48",
		"49",
		"4a",
		"4b",
		"4c",
		"4d",
		"4e",
		"4f",
		"50",
		"51",
		"52",
		"53",
		"54",
		"55",
		"56",
		"57",
		"58",
		"59",
		"5a",
		"5b",
		"5c",
		"5d",
		"5e",
		"5f",
		"60",
		"61",
		"62",
		"63",
		"64",
		"65",
		"66",
		"67",
		"68",
		"69",
		"6a",
		"6b",
		"6c",
		"6d",
		"6e",
		"6f",
		"70",
		"71",
		"72",
		"73",
		"74",
		"75",
		"76",
		"77",
		"78",
		"79",
		"7a",
		"7b",
		"7c",
		"7d",
		"7e",
		"7f",
		"80",
		"81",
		"82",
		"83",
		"84",
		"85",
		"86",
		"87",
		"88",
		"89",
		"8a",
		"8b",
		"8c",
		"8d",
		"8e",
		"8f",
		"90",
		"91",
		"92",
		"93",
		"94",
		"95",
		"96",
		"97",
		"98",
		"99",
		"9a",
		"9b",
		"9c",
		"9d",
		"9e",
		"9f",
		"a0",
		"a1",
		"a2",
		"a3",
		"a4",
		"a5",
		"a6",
		"a7",
		"a8",
		"a9",
		"aa",
		"ab",
		"ac",
		"ad",
		"ae",
		"af",
		"b0",
		"b1",
		"b2",
		"b3",
		"b4",
		"b5",
		"b6",
		"b7",
		"b8",
		"b9",
		"ba",
		"bb",
		"bc",
		"bd",
		"be",
		"bf",
		"c0",
		"c1",
		"c2",
		"c3",
		"c4",
		"c5",
		"c6",
		"c7",
		"c8",
		"c9",
		"ca",
		"cb",
		"cc",
		"cd",
		"ce",
		"cf",
		"d0",
		"d1",
		"d2",
		"d3",
		"d4",
		"d5",
		"d6",
		"d7",
		"d8",
		"d9",
		"da",
		"db",
		"dc",
		"dd",
		"de",
		"df",
		"e0",
		"e1",
		"e2",
		"e3",
		"e4",
		"e5",
		"e6",
		"e7",
		"e8",
		"e9",
		"ea",
		"eb",
		"ec",
		"ed",
		"ee",
		"ef",
		"f0",
		"f1",
		"f2",
		"f3",
		"f4",
		"f5",
		"f6",
		"f7",
		"f8",
		"f9",
		"fa",
		"fb",
		"fc",
		"fd",
		"fe",
		"ff"
	];
	Math.PI / 180;
	180 / Math.PI;
	function kt() {
		const i = Math.random() * 4294967295 | 0, t = Math.random() * 4294967295 | 0, e = Math.random() * 4294967295 | 0, s = Math.random() * 4294967295 | 0;
		return (D[i & 255] + D[i >> 8 & 255] + D[i >> 16 & 255] + D[i >> 24 & 255] + "-" + D[t & 255] + D[t >> 8 & 255] + "-" + D[t >> 16 & 15 | 64] + D[t >> 24 & 255] + "-" + D[e & 63 | 128] + D[e >> 8 & 255] + "-" + D[e >> 16 & 255] + D[e >> 24 & 255] + D[s & 255] + D[s >> 8 & 255] + D[s >> 16 & 255] + D[s >> 24 & 255]).toLowerCase();
	}
	function C(i, t, e) {
		return Math.max(t, Math.min(e, i));
	}
	function Ai(i, t) {
		return (i % t + t) % t;
	}
	function ye(i, t, e) {
		return (1 - e) * i + e * t;
	}
	function It(i, t) {
		switch (t.constructor) {
			case Float32Array: return i;
			case Uint32Array: return i / 4294967295;
			case Uint16Array: return i / 65535;
			case Uint8Array: return i / 255;
			case Int32Array: return Math.max(i / 2147483647, -1);
			case Int16Array: return Math.max(i / 32767, -1);
			case Int8Array: return Math.max(i / 127, -1);
			default: throw new Error("Invalid component type.");
		}
	}
	function W(i, t) {
		switch (t.constructor) {
			case Float32Array: return i;
			case Uint32Array: return Math.round(i * 4294967295);
			case Uint16Array: return Math.round(i * 65535);
			case Uint8Array: return Math.round(i * 255);
			case Int32Array: return Math.round(i * 2147483647);
			case Int16Array: return Math.round(i * 32767);
			case Int8Array: return Math.round(i * 127);
			default: throw new Error("Invalid component type.");
		}
	}
	var $ = class yi {
		constructor(t = 0, e = 0) {
			yi.prototype.isVector2 = !0, this.x = t, this.y = e;
		}
		get width() {
			return this.x;
		}
		set width(t) {
			this.x = t;
		}
		get height() {
			return this.y;
		}
		set height(t) {
			this.y = t;
		}
		set(t, e) {
			return this.x = t, this.y = e, this;
		}
		setScalar(t) {
			return this.x = t, this.y = t, this;
		}
		setX(t) {
			return this.x = t, this;
		}
		setY(t) {
			return this.y = t, this;
		}
		setComponent(t, e) {
			switch (t) {
				case 0:
					this.x = e;
					break;
				case 1:
					this.y = e;
					break;
				default: throw new Error("index is out of range: " + t);
			}
			return this;
		}
		getComponent(t) {
			switch (t) {
				case 0: return this.x;
				case 1: return this.y;
				default: throw new Error("index is out of range: " + t);
			}
		}
		clone() {
			return new this.constructor(this.x, this.y);
		}
		copy(t) {
			return this.x = t.x, this.y = t.y, this;
		}
		add(t) {
			return this.x += t.x, this.y += t.y, this;
		}
		addScalar(t) {
			return this.x += t, this.y += t, this;
		}
		addVectors(t, e) {
			return this.x = t.x + e.x, this.y = t.y + e.y, this;
		}
		addScaledVector(t, e) {
			return this.x += t.x * e, this.y += t.y * e, this;
		}
		sub(t) {
			return this.x -= t.x, this.y -= t.y, this;
		}
		subScalar(t) {
			return this.x -= t, this.y -= t, this;
		}
		subVectors(t, e) {
			return this.x = t.x - e.x, this.y = t.y - e.y, this;
		}
		multiply(t) {
			return this.x *= t.x, this.y *= t.y, this;
		}
		multiplyScalar(t) {
			return this.x *= t, this.y *= t, this;
		}
		divide(t) {
			return this.x /= t.x, this.y /= t.y, this;
		}
		divideScalar(t) {
			return this.multiplyScalar(1 / t);
		}
		applyMatrix3(t) {
			const e = this.x, s = this.y, r = t.elements;
			return this.x = r[0] * e + r[3] * s + r[6], this.y = r[1] * e + r[4] * s + r[7], this;
		}
		min(t) {
			return this.x = Math.min(this.x, t.x), this.y = Math.min(this.y, t.y), this;
		}
		max(t) {
			return this.x = Math.max(this.x, t.x), this.y = Math.max(this.y, t.y), this;
		}
		clamp(t, e) {
			return this.x = C(this.x, t.x, e.x), this.y = C(this.y, t.y, e.y), this;
		}
		clampScalar(t, e) {
			return this.x = C(this.x, t, e), this.y = C(this.y, t, e), this;
		}
		clampLength(t, e) {
			const s = this.length();
			return this.divideScalar(s || 1).multiplyScalar(C(s, t, e));
		}
		floor() {
			return this.x = Math.floor(this.x), this.y = Math.floor(this.y), this;
		}
		ceil() {
			return this.x = Math.ceil(this.x), this.y = Math.ceil(this.y), this;
		}
		round() {
			return this.x = Math.round(this.x), this.y = Math.round(this.y), this;
		}
		roundToZero() {
			return this.x = Math.trunc(this.x), this.y = Math.trunc(this.y), this;
		}
		negate() {
			return this.x = -this.x, this.y = -this.y, this;
		}
		dot(t) {
			return this.x * t.x + this.y * t.y;
		}
		cross(t) {
			return this.x * t.y - this.y * t.x;
		}
		lengthSq() {
			return this.x * this.x + this.y * this.y;
		}
		length() {
			return Math.sqrt(this.x * this.x + this.y * this.y);
		}
		manhattanLength() {
			return Math.abs(this.x) + Math.abs(this.y);
		}
		normalize() {
			return this.divideScalar(this.length() || 1);
		}
		angle() {
			return Math.atan2(-this.y, -this.x) + Math.PI;
		}
		angleTo(t) {
			const e = Math.sqrt(this.lengthSq() * t.lengthSq());
			if (e === 0) return Math.PI / 2;
			const s = this.dot(t) / e;
			return Math.acos(C(s, -1, 1));
		}
		distanceTo(t) {
			return Math.sqrt(this.distanceToSquared(t));
		}
		distanceToSquared(t) {
			const e = this.x - t.x, s = this.y - t.y;
			return e * e + s * s;
		}
		manhattanDistanceTo(t) {
			return Math.abs(this.x - t.x) + Math.abs(this.y - t.y);
		}
		setLength(t) {
			return this.normalize().multiplyScalar(t);
		}
		lerp(t, e) {
			return this.x += (t.x - this.x) * e, this.y += (t.y - this.y) * e, this;
		}
		lerpVectors(t, e, s) {
			return this.x = t.x + (e.x - t.x) * s, this.y = t.y + (e.y - t.y) * s, this;
		}
		equals(t) {
			return t.x === this.x && t.y === this.y;
		}
		fromArray(t, e = 0) {
			return this.x = t[e], this.y = t[e + 1], this;
		}
		toArray(t = [], e = 0) {
			return t[e] = this.x, t[e + 1] = this.y, t;
		}
		fromBufferAttribute(t, e) {
			return this.x = t.getX(e), this.y = t.getY(e), this;
		}
		rotateAround(t, e) {
			const s = Math.cos(e), r = Math.sin(e), n = this.x - t.x, o = this.y - t.y;
			return this.x = n * s - o * r + t.x, this.y = n * r + o * s + t.y, this;
		}
		random() {
			return this.x = Math.random(), this.y = Math.random(), this;
		}
		*[Symbol.iterator]() {
			yield this.x, yield this.y;
		}
	}, pt = class {
		constructor(i = 0, t = 0, e = 0, s = 1) {
			this.isQuaternion = !0, this._x = i, this._y = t, this._z = e, this._w = s;
		}
		static slerpFlat(i, t, e, s, r, n, o) {
			let a = e[s + 0], l = e[s + 1], h = e[s + 2], c = e[s + 3], u = r[n + 0], d = r[n + 1], p = r[n + 2], m = r[n + 3];
			if (c !== m || a !== u || l !== d || h !== p) {
				let f = a * u + l * d + h * p + c * m;
				f < 0 && (u = -u, d = -d, p = -p, m = -m, f = -f);
				let y = 1 - o;
				if (f < .9995) {
					const g = Math.acos(f), b = Math.sin(g);
					y = Math.sin(y * g) / b, o = Math.sin(o * g) / b, a = a * y + u * o, l = l * y + d * o, h = h * y + p * o, c = c * y + m * o;
				} else {
					a = a * y + u * o, l = l * y + d * o, h = h * y + p * o, c = c * y + m * o;
					const g = 1 / Math.sqrt(a * a + l * l + h * h + c * c);
					a *= g, l *= g, h *= g, c *= g;
				}
			}
			i[t] = a, i[t + 1] = l, i[t + 2] = h, i[t + 3] = c;
		}
		static multiplyQuaternionsFlat(i, t, e, s, r, n) {
			const o = e[s], a = e[s + 1], l = e[s + 2], h = e[s + 3], c = r[n], u = r[n + 1], d = r[n + 2], p = r[n + 3];
			return i[t] = o * p + h * c + a * d - l * u, i[t + 1] = a * p + h * u + l * c - o * d, i[t + 2] = l * p + h * d + o * u - a * c, i[t + 3] = h * p - o * c - a * u - l * d, i;
		}
		get x() {
			return this._x;
		}
		set x(i) {
			this._x = i, this._onChangeCallback();
		}
		get y() {
			return this._y;
		}
		set y(i) {
			this._y = i, this._onChangeCallback();
		}
		get z() {
			return this._z;
		}
		set z(i) {
			this._z = i, this._onChangeCallback();
		}
		get w() {
			return this._w;
		}
		set w(i) {
			this._w = i, this._onChangeCallback();
		}
		set(i, t, e, s) {
			return this._x = i, this._y = t, this._z = e, this._w = s, this._onChangeCallback(), this;
		}
		clone() {
			return new this.constructor(this._x, this._y, this._z, this._w);
		}
		copy(i) {
			return this._x = i.x, this._y = i.y, this._z = i.z, this._w = i.w, this._onChangeCallback(), this;
		}
		setFromEuler(i, t = !0) {
			const e = i._x, s = i._y, r = i._z, n = i._order, o = Math.cos, a = Math.sin, l = o(e / 2), h = o(s / 2), c = o(r / 2), u = a(e / 2), d = a(s / 2), p = a(r / 2);
			switch (n) {
				case "XYZ":
					this._x = u * h * c + l * d * p, this._y = l * d * c - u * h * p, this._z = l * h * p + u * d * c, this._w = l * h * c - u * d * p;
					break;
				case "YXZ":
					this._x = u * h * c + l * d * p, this._y = l * d * c - u * h * p, this._z = l * h * p - u * d * c, this._w = l * h * c + u * d * p;
					break;
				case "ZXY":
					this._x = u * h * c - l * d * p, this._y = l * d * c + u * h * p, this._z = l * h * p + u * d * c, this._w = l * h * c - u * d * p;
					break;
				case "ZYX":
					this._x = u * h * c - l * d * p, this._y = l * d * c + u * h * p, this._z = l * h * p - u * d * c, this._w = l * h * c + u * d * p;
					break;
				case "YZX":
					this._x = u * h * c + l * d * p, this._y = l * d * c + u * h * p, this._z = l * h * p - u * d * c, this._w = l * h * c - u * d * p;
					break;
				case "XZY":
					this._x = u * h * c - l * d * p, this._y = l * d * c - u * h * p, this._z = l * h * p + u * d * c, this._w = l * h * c + u * d * p;
					break;
				default: F("Quaternion: .setFromEuler() encountered an unknown order: " + n);
			}
			return t === !0 && this._onChangeCallback(), this;
		}
		setFromAxisAngle(i, t) {
			const e = t / 2, s = Math.sin(e);
			return this._x = i.x * s, this._y = i.y * s, this._z = i.z * s, this._w = Math.cos(e), this._onChangeCallback(), this;
		}
		setFromRotationMatrix(i) {
			const t = i.elements, e = t[0], s = t[4], r = t[8], n = t[1], o = t[5], a = t[9], l = t[2], h = t[6], c = t[10], u = e + o + c;
			if (u > 0) {
				const d = .5 / Math.sqrt(u + 1);
				this._w = .25 / d, this._x = (h - a) * d, this._y = (r - l) * d, this._z = (n - s) * d;
			} else if (e > o && e > c) {
				const d = 2 * Math.sqrt(1 + e - o - c);
				this._w = (h - a) / d, this._x = .25 * d, this._y = (s + n) / d, this._z = (r + l) / d;
			} else if (o > c) {
				const d = 2 * Math.sqrt(1 + o - e - c);
				this._w = (r - l) / d, this._x = (s + n) / d, this._y = .25 * d, this._z = (a + h) / d;
			} else {
				const d = 2 * Math.sqrt(1 + c - e - o);
				this._w = (n - s) / d, this._x = (r + l) / d, this._y = (a + h) / d, this._z = .25 * d;
			}
			return this._onChangeCallback(), this;
		}
		setFromUnitVectors(i, t) {
			let e = i.dot(t) + 1;
			return e < 1e-8 ? (e = 0, Math.abs(i.x) > Math.abs(i.z) ? (this._x = -i.y, this._y = i.x, this._z = 0, this._w = e) : (this._x = 0, this._y = -i.z, this._z = i.y, this._w = e)) : (this._x = i.y * t.z - i.z * t.y, this._y = i.z * t.x - i.x * t.z, this._z = i.x * t.y - i.y * t.x, this._w = e), this.normalize();
		}
		angleTo(i) {
			return 2 * Math.acos(Math.abs(C(this.dot(i), -1, 1)));
		}
		rotateTowards(i, t) {
			const e = this.angleTo(i);
			if (e === 0) return this;
			const s = Math.min(1, t / e);
			return this.slerp(i, s), this;
		}
		identity() {
			return this.set(0, 0, 0, 1);
		}
		invert() {
			return this.conjugate();
		}
		conjugate() {
			return this._x *= -1, this._y *= -1, this._z *= -1, this._onChangeCallback(), this;
		}
		dot(i) {
			return this._x * i._x + this._y * i._y + this._z * i._z + this._w * i._w;
		}
		lengthSq() {
			return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w;
		}
		length() {
			return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w);
		}
		normalize() {
			let i = this.length();
			return i === 0 ? (this._x = 0, this._y = 0, this._z = 0, this._w = 1) : (i = 1 / i, this._x = this._x * i, this._y = this._y * i, this._z = this._z * i, this._w = this._w * i), this._onChangeCallback(), this;
		}
		multiply(i) {
			return this.multiplyQuaternions(this, i);
		}
		premultiply(i) {
			return this.multiplyQuaternions(i, this);
		}
		multiplyQuaternions(i, t) {
			const e = i._x, s = i._y, r = i._z, n = i._w, o = t._x, a = t._y, l = t._z, h = t._w;
			return this._x = e * h + n * o + s * l - r * a, this._y = s * h + n * a + r * o - e * l, this._z = r * h + n * l + e * a - s * o, this._w = n * h - e * o - s * a - r * l, this._onChangeCallback(), this;
		}
		slerp(i, t) {
			let e = i._x, s = i._y, r = i._z, n = i._w, o = this.dot(i);
			o < 0 && (e = -e, s = -s, r = -r, n = -n, o = -o);
			let a = 1 - t;
			if (o < .9995) {
				const l = Math.acos(o), h = Math.sin(l);
				a = Math.sin(a * l) / h, t = Math.sin(t * l) / h, this._x = this._x * a + e * t, this._y = this._y * a + s * t, this._z = this._z * a + r * t, this._w = this._w * a + n * t, this._onChangeCallback();
			} else this._x = this._x * a + e * t, this._y = this._y * a + s * t, this._z = this._z * a + r * t, this._w = this._w * a + n * t, this.normalize();
			return this;
		}
		slerpQuaternions(i, t, e) {
			return this.copy(i).slerp(t, e);
		}
		random() {
			const i = 2 * Math.PI * Math.random(), t = 2 * Math.PI * Math.random(), e = Math.random(), s = Math.sqrt(1 - e), r = Math.sqrt(e);
			return this.set(s * Math.sin(i), s * Math.cos(i), r * Math.sin(t), r * Math.cos(t));
		}
		equals(i) {
			return i._x === this._x && i._y === this._y && i._z === this._z && i._w === this._w;
		}
		fromArray(i, t = 0) {
			return this._x = i[t], this._y = i[t + 1], this._z = i[t + 2], this._w = i[t + 3], this._onChangeCallback(), this;
		}
		toArray(i = [], t = 0) {
			return i[t] = this._x, i[t + 1] = this._y, i[t + 2] = this._z, i[t + 3] = this._w, i;
		}
		fromBufferAttribute(i, t) {
			return this._x = i.getX(t), this._y = i.getY(t), this._z = i.getZ(t), this._w = i.getW(t), this._onChangeCallback(), this;
		}
		toJSON() {
			return this.toArray();
		}
		_onChange(i) {
			return this._onChangeCallback = i, this;
		}
		_onChangeCallback() {}
		*[Symbol.iterator]() {
			yield this._x, yield this._y, yield this._z, yield this._w;
		}
	}, x = class gi {
		constructor(t = 0, e = 0, s = 0) {
			gi.prototype.isVector3 = !0, this.x = t, this.y = e, this.z = s;
		}
		set(t, e, s) {
			return s === void 0 && (s = this.z), this.x = t, this.y = e, this.z = s, this;
		}
		setScalar(t) {
			return this.x = t, this.y = t, this.z = t, this;
		}
		setX(t) {
			return this.x = t, this;
		}
		setY(t) {
			return this.y = t, this;
		}
		setZ(t) {
			return this.z = t, this;
		}
		setComponent(t, e) {
			switch (t) {
				case 0:
					this.x = e;
					break;
				case 1:
					this.y = e;
					break;
				case 2:
					this.z = e;
					break;
				default: throw new Error("index is out of range: " + t);
			}
			return this;
		}
		getComponent(t) {
			switch (t) {
				case 0: return this.x;
				case 1: return this.y;
				case 2: return this.z;
				default: throw new Error("index is out of range: " + t);
			}
		}
		clone() {
			return new this.constructor(this.x, this.y, this.z);
		}
		copy(t) {
			return this.x = t.x, this.y = t.y, this.z = t.z, this;
		}
		add(t) {
			return this.x += t.x, this.y += t.y, this.z += t.z, this;
		}
		addScalar(t) {
			return this.x += t, this.y += t, this.z += t, this;
		}
		addVectors(t, e) {
			return this.x = t.x + e.x, this.y = t.y + e.y, this.z = t.z + e.z, this;
		}
		addScaledVector(t, e) {
			return this.x += t.x * e, this.y += t.y * e, this.z += t.z * e, this;
		}
		sub(t) {
			return this.x -= t.x, this.y -= t.y, this.z -= t.z, this;
		}
		subScalar(t) {
			return this.x -= t, this.y -= t, this.z -= t, this;
		}
		subVectors(t, e) {
			return this.x = t.x - e.x, this.y = t.y - e.y, this.z = t.z - e.z, this;
		}
		multiply(t) {
			return this.x *= t.x, this.y *= t.y, this.z *= t.z, this;
		}
		multiplyScalar(t) {
			return this.x *= t, this.y *= t, this.z *= t, this;
		}
		multiplyVectors(t, e) {
			return this.x = t.x * e.x, this.y = t.y * e.y, this.z = t.z * e.z, this;
		}
		applyEuler(t) {
			return this.applyQuaternion(Ge.setFromEuler(t));
		}
		applyAxisAngle(t, e) {
			return this.applyQuaternion(Ge.setFromAxisAngle(t, e));
		}
		applyMatrix3(t) {
			const e = this.x, s = this.y, r = this.z, n = t.elements;
			return this.x = n[0] * e + n[3] * s + n[6] * r, this.y = n[1] * e + n[4] * s + n[7] * r, this.z = n[2] * e + n[5] * s + n[8] * r, this;
		}
		applyNormalMatrix(t) {
			return this.applyMatrix3(t).normalize();
		}
		applyMatrix4(t) {
			const e = this.x, s = this.y, r = this.z, n = t.elements, o = 1 / (n[3] * e + n[7] * s + n[11] * r + n[15]);
			return this.x = (n[0] * e + n[4] * s + n[8] * r + n[12]) * o, this.y = (n[1] * e + n[5] * s + n[9] * r + n[13]) * o, this.z = (n[2] * e + n[6] * s + n[10] * r + n[14]) * o, this;
		}
		applyQuaternion(t) {
			const e = this.x, s = this.y, r = this.z, n = t.x, o = t.y, a = t.z, l = t.w, h = 2 * (o * r - a * s), c = 2 * (a * e - n * r), u = 2 * (n * s - o * e);
			return this.x = e + l * h + o * u - a * c, this.y = s + l * c + a * h - n * u, this.z = r + l * u + n * c - o * h, this;
		}
		project(t) {
			return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix);
		}
		unproject(t) {
			return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld);
		}
		transformDirection(t) {
			const e = this.x, s = this.y, r = this.z, n = t.elements;
			return this.x = n[0] * e + n[4] * s + n[8] * r, this.y = n[1] * e + n[5] * s + n[9] * r, this.z = n[2] * e + n[6] * s + n[10] * r, this.normalize();
		}
		divide(t) {
			return this.x /= t.x, this.y /= t.y, this.z /= t.z, this;
		}
		divideScalar(t) {
			return this.multiplyScalar(1 / t);
		}
		min(t) {
			return this.x = Math.min(this.x, t.x), this.y = Math.min(this.y, t.y), this.z = Math.min(this.z, t.z), this;
		}
		max(t) {
			return this.x = Math.max(this.x, t.x), this.y = Math.max(this.y, t.y), this.z = Math.max(this.z, t.z), this;
		}
		clamp(t, e) {
			return this.x = C(this.x, t.x, e.x), this.y = C(this.y, t.y, e.y), this.z = C(this.z, t.z, e.z), this;
		}
		clampScalar(t, e) {
			return this.x = C(this.x, t, e), this.y = C(this.y, t, e), this.z = C(this.z, t, e), this;
		}
		clampLength(t, e) {
			const s = this.length();
			return this.divideScalar(s || 1).multiplyScalar(C(s, t, e));
		}
		floor() {
			return this.x = Math.floor(this.x), this.y = Math.floor(this.y), this.z = Math.floor(this.z), this;
		}
		ceil() {
			return this.x = Math.ceil(this.x), this.y = Math.ceil(this.y), this.z = Math.ceil(this.z), this;
		}
		round() {
			return this.x = Math.round(this.x), this.y = Math.round(this.y), this.z = Math.round(this.z), this;
		}
		roundToZero() {
			return this.x = Math.trunc(this.x), this.y = Math.trunc(this.y), this.z = Math.trunc(this.z), this;
		}
		negate() {
			return this.x = -this.x, this.y = -this.y, this.z = -this.z, this;
		}
		dot(t) {
			return this.x * t.x + this.y * t.y + this.z * t.z;
		}
		lengthSq() {
			return this.x * this.x + this.y * this.y + this.z * this.z;
		}
		length() {
			return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
		}
		manhattanLength() {
			return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z);
		}
		normalize() {
			return this.divideScalar(this.length() || 1);
		}
		setLength(t) {
			return this.normalize().multiplyScalar(t);
		}
		lerp(t, e) {
			return this.x += (t.x - this.x) * e, this.y += (t.y - this.y) * e, this.z += (t.z - this.z) * e, this;
		}
		lerpVectors(t, e, s) {
			return this.x = t.x + (e.x - t.x) * s, this.y = t.y + (e.y - t.y) * s, this.z = t.z + (e.z - t.z) * s, this;
		}
		cross(t) {
			return this.crossVectors(this, t);
		}
		crossVectors(t, e) {
			const s = t.x, r = t.y, n = t.z, o = e.x, a = e.y, l = e.z;
			return this.x = r * l - n * a, this.y = n * o - s * l, this.z = s * a - r * o, this;
		}
		projectOnVector(t) {
			const e = t.lengthSq();
			if (e === 0) return this.set(0, 0, 0);
			const s = t.dot(this) / e;
			return this.copy(t).multiplyScalar(s);
		}
		projectOnPlane(t) {
			return ge.copy(this).projectOnVector(t), this.sub(ge);
		}
		reflect(t) {
			return this.sub(ge.copy(t).multiplyScalar(2 * this.dot(t)));
		}
		angleTo(t) {
			const e = Math.sqrt(this.lengthSq() * t.lengthSq());
			if (e === 0) return Math.PI / 2;
			const s = this.dot(t) / e;
			return Math.acos(C(s, -1, 1));
		}
		distanceTo(t) {
			return Math.sqrt(this.distanceToSquared(t));
		}
		distanceToSquared(t) {
			const e = this.x - t.x, s = this.y - t.y, r = this.z - t.z;
			return e * e + s * s + r * r;
		}
		manhattanDistanceTo(t) {
			return Math.abs(this.x - t.x) + Math.abs(this.y - t.y) + Math.abs(this.z - t.z);
		}
		setFromSpherical(t) {
			return this.setFromSphericalCoords(t.radius, t.phi, t.theta);
		}
		setFromSphericalCoords(t, e, s) {
			const r = Math.sin(e) * t;
			return this.x = r * Math.sin(s), this.y = Math.cos(e) * t, this.z = r * Math.cos(s), this;
		}
		setFromCylindrical(t) {
			return this.setFromCylindricalCoords(t.radius, t.theta, t.y);
		}
		setFromCylindricalCoords(t, e, s) {
			return this.x = t * Math.sin(e), this.y = s, this.z = t * Math.cos(e), this;
		}
		setFromMatrixPosition(t) {
			const e = t.elements;
			return this.x = e[12], this.y = e[13], this.z = e[14], this;
		}
		setFromMatrixScale(t) {
			const e = this.setFromMatrixColumn(t, 0).length(), s = this.setFromMatrixColumn(t, 1).length(), r = this.setFromMatrixColumn(t, 2).length();
			return this.x = e, this.y = s, this.z = r, this;
		}
		setFromMatrixColumn(t, e) {
			return this.fromArray(t.elements, e * 4);
		}
		setFromMatrix3Column(t, e) {
			return this.fromArray(t.elements, e * 3);
		}
		setFromEuler(t) {
			return this.x = t._x, this.y = t._y, this.z = t._z, this;
		}
		setFromColor(t) {
			return this.x = t.r, this.y = t.g, this.z = t.b, this;
		}
		equals(t) {
			return t.x === this.x && t.y === this.y && t.z === this.z;
		}
		fromArray(t, e = 0) {
			return this.x = t[e], this.y = t[e + 1], this.z = t[e + 2], this;
		}
		toArray(t = [], e = 0) {
			return t[e] = this.x, t[e + 1] = this.y, t[e + 2] = this.z, t;
		}
		fromBufferAttribute(t, e) {
			return this.x = t.getX(e), this.y = t.getY(e), this.z = t.getZ(e), this;
		}
		random() {
			return this.x = Math.random(), this.y = Math.random(), this.z = Math.random(), this;
		}
		randomDirection() {
			const t = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1, s = Math.sqrt(1 - e * e);
			return this.x = s * Math.cos(t), this.y = e, this.z = s * Math.sin(t), this;
		}
		*[Symbol.iterator]() {
			yield this.x, yield this.y, yield this.z;
		}
	};
	const ge = new x(), Ge = new pt();
	var mt = class xi {
		constructor(t, e, s, r, n, o, a, l, h) {
			xi.prototype.isMatrix3 = !0, this.elements = [
				1,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				1
			], t !== void 0 && this.set(t, e, s, r, n, o, a, l, h);
		}
		set(t, e, s, r, n, o, a, l, h) {
			const c = this.elements;
			return c[0] = t, c[1] = r, c[2] = a, c[3] = e, c[4] = n, c[5] = l, c[6] = s, c[7] = o, c[8] = h, this;
		}
		identity() {
			return this.set(1, 0, 0, 0, 1, 0, 0, 0, 1), this;
		}
		copy(t) {
			const e = this.elements, s = t.elements;
			return e[0] = s[0], e[1] = s[1], e[2] = s[2], e[3] = s[3], e[4] = s[4], e[5] = s[5], e[6] = s[6], e[7] = s[7], e[8] = s[8], this;
		}
		extractBasis(t, e, s) {
			return t.setFromMatrix3Column(this, 0), e.setFromMatrix3Column(this, 1), s.setFromMatrix3Column(this, 2), this;
		}
		setFromMatrix4(t) {
			const e = t.elements;
			return this.set(e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]), this;
		}
		multiply(t) {
			return this.multiplyMatrices(this, t);
		}
		premultiply(t) {
			return this.multiplyMatrices(t, this);
		}
		multiplyMatrices(t, e) {
			const s = t.elements, r = e.elements, n = this.elements, o = s[0], a = s[3], l = s[6], h = s[1], c = s[4], u = s[7], d = s[2], p = s[5], m = s[8], f = r[0], y = r[3], g = r[6], b = r[1], _ = r[4], M = r[7], w = r[2], z = r[5], S = r[8];
			return n[0] = o * f + a * b + l * w, n[3] = o * y + a * _ + l * z, n[6] = o * g + a * M + l * S, n[1] = h * f + c * b + u * w, n[4] = h * y + c * _ + u * z, n[7] = h * g + c * M + u * S, n[2] = d * f + p * b + m * w, n[5] = d * y + p * _ + m * z, n[8] = d * g + p * M + m * S, this;
		}
		multiplyScalar(t) {
			const e = this.elements;
			return e[0] *= t, e[3] *= t, e[6] *= t, e[1] *= t, e[4] *= t, e[7] *= t, e[2] *= t, e[5] *= t, e[8] *= t, this;
		}
		determinant() {
			const t = this.elements, e = t[0], s = t[1], r = t[2], n = t[3], o = t[4], a = t[5], l = t[6], h = t[7], c = t[8];
			return e * o * c - e * a * h - s * n * c + s * a * l + r * n * h - r * o * l;
		}
		invert() {
			const t = this.elements, e = t[0], s = t[1], r = t[2], n = t[3], o = t[4], a = t[5], l = t[6], h = t[7], c = t[8], u = c * o - a * h, d = a * l - c * n, p = h * n - o * l, m = e * u + s * d + r * p;
			if (m === 0) return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0);
			const f = 1 / m;
			return t[0] = u * f, t[1] = (r * h - c * s) * f, t[2] = (a * s - r * o) * f, t[3] = d * f, t[4] = (c * e - r * l) * f, t[5] = (r * n - a * e) * f, t[6] = p * f, t[7] = (s * l - h * e) * f, t[8] = (o * e - s * n) * f, this;
		}
		transpose() {
			let t;
			const e = this.elements;
			return t = e[1], e[1] = e[3], e[3] = t, t = e[2], e[2] = e[6], e[6] = t, t = e[5], e[5] = e[7], e[7] = t, this;
		}
		getNormalMatrix(t) {
			return this.setFromMatrix4(t).invert().transpose();
		}
		transposeIntoArray(t) {
			const e = this.elements;
			return t[0] = e[0], t[1] = e[3], t[2] = e[6], t[3] = e[1], t[4] = e[4], t[5] = e[7], t[6] = e[2], t[7] = e[5], t[8] = e[8], this;
		}
		setUvTransform(t, e, s, r, n, o, a) {
			const l = Math.cos(n), h = Math.sin(n);
			return this.set(s * l, s * h, -s * (l * o + h * a) + o + t, -r * h, r * l, -r * (-h * o + l * a) + a + e, 0, 0, 1), this;
		}
		scale(t, e) {
			return this.premultiply(xe.makeScale(t, e)), this;
		}
		rotate(t) {
			return this.premultiply(xe.makeRotation(-t)), this;
		}
		translate(t, e) {
			return this.premultiply(xe.makeTranslation(t, e)), this;
		}
		makeTranslation(t, e) {
			return t.isVector2 ? this.set(1, 0, t.x, 0, 1, t.y, 0, 0, 1) : this.set(1, 0, t, 0, 1, e, 0, 0, 1), this;
		}
		makeRotation(t) {
			const e = Math.cos(t), s = Math.sin(t);
			return this.set(e, -s, 0, s, e, 0, 0, 0, 1), this;
		}
		makeScale(t, e) {
			return this.set(t, 0, 0, 0, e, 0, 0, 0, 1), this;
		}
		equals(t) {
			const e = this.elements, s = t.elements;
			for (let r = 0; r < 9; r++) if (e[r] !== s[r]) return !1;
			return !0;
		}
		fromArray(t, e = 0) {
			for (let s = 0; s < 9; s++) this.elements[s] = t[s + e];
			return this;
		}
		toArray(t = [], e = 0) {
			const s = this.elements;
			return t[e] = s[0], t[e + 1] = s[1], t[e + 2] = s[2], t[e + 3] = s[3], t[e + 4] = s[4], t[e + 5] = s[5], t[e + 6] = s[6], t[e + 7] = s[7], t[e + 8] = s[8], t;
		}
		clone() {
			return new this.constructor().fromArray(this.elements);
		}
	};
	const xe = new mt(), $e = new mt().set(.4123908, .3575843, .1804808, .212639, .7151687, .0721923, .0193308, .1191948, .9505322), Qe = new mt().set(3.2409699, -1.5373832, -.4986108, -.9692436, 1.8759675, .0415551, .0556301, -.203977, 1.0569715);
	function vi() {
		const i = {
			enabled: !0,
			workingColorSpace: je,
			spaces: {},
			convert: function(r, n, o) {
				return this.enabled === !1 || n === o || !n || !o || (this.spaces[n].transfer === "srgb" && (r.r = Q(r.r), r.g = Q(r.g), r.b = Q(r.b)), this.spaces[n].primaries !== this.spaces[o].primaries && (r.applyMatrix3(this.spaces[n].toXYZ), r.applyMatrix3(this.spaces[o].fromXYZ)), this.spaces[o].transfer === "srgb" && (r.r = ft(r.r), r.g = ft(r.g), r.b = ft(r.b))), r;
			},
			workingToColorSpace: function(r, n) {
				return this.convert(r, this.workingColorSpace, n);
			},
			colorSpaceToWorking: function(r, n) {
				return this.convert(r, n, this.workingColorSpace);
			},
			getPrimaries: function(r) {
				return this.spaces[r].primaries;
			},
			getTransfer: function(r) {
				return r === "" ? Xe : this.spaces[r].transfer;
			},
			getToneMappingMode: function(r) {
				return this.spaces[r].outputColorSpaceConfig.toneMappingMode || "standard";
			},
			getLuminanceCoefficients: function(r, n = this.workingColorSpace) {
				return r.fromArray(this.spaces[n].luminanceCoefficients);
			},
			define: function(r) {
				Object.assign(this.spaces, r);
			},
			_getMatrix: function(r, n, o) {
				return r.copy(this.spaces[n].toXYZ).multiply(this.spaces[o].fromXYZ);
			},
			_getDrawingBufferColorSpace: function(r) {
				return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace;
			},
			_getUnpackColorSpace: function(r = this.workingColorSpace) {
				return this.spaces[r].workingColorSpaceConfig.unpackColorSpace;
			},
			fromWorkingColorSpace: function(r, n) {
				return Je("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."), i.workingToColorSpace(r, n);
			},
			toWorkingColorSpace: function(r, n) {
				return Je("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."), i.colorSpaceToWorking(r, n);
			}
		}, t = [
			.64,
			.33,
			.3,
			.6,
			.15,
			.06
		], e = [
			.2126,
			.7152,
			.0722
		], s = [.3127, .329];
		return i.define({
			[je]: {
				primaries: t,
				whitePoint: s,
				transfer: Xe,
				toXYZ: $e,
				fromXYZ: Qe,
				luminanceCoefficients: e,
				workingColorSpaceConfig: { unpackColorSpace: J },
				outputColorSpaceConfig: { drawingBufferColorSpace: J }
			},
			[J]: {
				primaries: t,
				whitePoint: s,
				transfer: wi,
				toXYZ: $e,
				fromXYZ: Qe,
				luminanceCoefficients: e,
				outputColorSpaceConfig: { drawingBufferColorSpace: J }
			}
		}), i;
	}
	const X = vi();
	function Q(i) {
		return i < .04045 ? i * .0773993808 : Math.pow(i * .9478672986 + .0521327014, 2.4);
	}
	function ft(i) {
		return i < .0031308 ? i * 12.92 : 1.055 * Math.pow(i, .41666) - .055;
	}
	let yt;
	var Ti = class {
		static getDataURL(i, t = "image/png") {
			if (/^data:/i.test(i.src) || typeof HTMLCanvasElement > "u") return i.src;
			let e;
			if (i instanceof HTMLCanvasElement) e = i;
			else {
				yt === void 0 && (yt = Ze("canvas")), yt.width = i.width, yt.height = i.height;
				const s = yt.getContext("2d");
				i instanceof ImageData ? s.putImageData(i, 0, 0) : s.drawImage(i, 0, 0, i.width, i.height), e = yt;
			}
			return e.toDataURL(t);
		}
		static sRGBToLinear(i) {
			if (typeof HTMLImageElement < "u" && i instanceof HTMLImageElement || typeof HTMLCanvasElement < "u" && i instanceof HTMLCanvasElement || typeof ImageBitmap < "u" && i instanceof ImageBitmap) {
				const t = Ze("canvas");
				t.width = i.width, t.height = i.height;
				const e = t.getContext("2d");
				e.drawImage(i, 0, 0, i.width, i.height);
				const s = e.getImageData(0, 0, i.width, i.height), r = s.data;
				for (let n = 0; n < r.length; n++) r[n] = Q(r[n] / 255) * 255;
				return e.putImageData(s, 0, 0), t;
			} else if (i.data) {
				const t = i.data.slice(0);
				for (let e = 0; e < t.length; e++) t instanceof Uint8Array || t instanceof Uint8ClampedArray ? t[e] = Math.floor(Q(t[e] / 255) * 255) : t[e] = Q(t[e]);
				return {
					data: t,
					width: i.width,
					height: i.height
				};
			} else return F("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."), i;
		}
	};
	let Ci = 0;
	var ki = class {
		constructor(i = null) {
			this.isSource = !0, Object.defineProperty(this, "id", { value: Ci++ }), this.uuid = kt(), this.data = i, this.dataReady = !0, this.version = 0;
		}
		getSize(i) {
			const t = this.data;
			return typeof HTMLVideoElement < "u" && t instanceof HTMLVideoElement ? i.set(t.videoWidth, t.videoHeight, 0) : typeof VideoFrame < "u" && t instanceof VideoFrame ? i.set(t.displayHeight, t.displayWidth, 0) : t !== null ? i.set(t.width, t.height, t.depth || 0) : i.set(0, 0, 0), i;
		}
		set needsUpdate(i) {
			i === !0 && this.version++;
		}
		toJSON(i) {
			const t = i === void 0 || typeof i == "string";
			if (!t && i.images[this.uuid] !== void 0) return i.images[this.uuid];
			const e = {
				uuid: this.uuid,
				url: ""
			}, s = this.data;
			if (s !== null) {
				let r;
				if (Array.isArray(s)) {
					r = [];
					for (let n = 0, o = s.length; n < o; n++) s[n].isDataTexture ? r.push(be(s[n].image)) : r.push(be(s[n]));
				} else r = be(s);
				e.url = r;
			}
			return t || (i.images[this.uuid] = e), e;
		}
	};
	function be(i) {
		return typeof HTMLImageElement < "u" && i instanceof HTMLImageElement || typeof HTMLCanvasElement < "u" && i instanceof HTMLCanvasElement || typeof ImageBitmap < "u" && i instanceof ImageBitmap ? Ti.getDataURL(i) : i.data ? {
			data: Array.from(i.data),
			width: i.width,
			height: i.height,
			type: i.data.constructor.name
		} : (F("Texture: Unable to serialize Texture."), {});
	}
	let Ii = 0;
	const Me = new x();
	var _e = class me extends Lt {
		constructor(t = me.DEFAULT_IMAGE, e = me.DEFAULT_MAPPING, s = 1001, r = 1001, n = 1006, o = 1008, a = 1023, l = 1009, h = me.DEFAULT_ANISOTROPY, c = "") {
			super(), this.isTexture = !0, Object.defineProperty(this, "id", { value: Ii++ }), this.uuid = kt(), this.name = "", this.source = new ki(t), this.mipmaps = [], this.mapping = e, this.channel = 0, this.wrapS = s, this.wrapT = r, this.magFilter = n, this.minFilter = o, this.anisotropy = h, this.format = a, this.internalFormat = null, this.type = l, this.offset = new $(0, 0), this.repeat = new $(1, 1), this.center = new $(0, 0), this.rotation = 0, this.matrixAutoUpdate = !0, this.matrix = new mt(), this.generateMipmaps = !0, this.premultiplyAlpha = !1, this.flipY = !0, this.unpackAlignment = 4, this.colorSpace = c, this.userData = {}, this.updateRanges = [], this.version = 0, this.onUpdate = null, this.renderTarget = null, this.isRenderTargetTexture = !1, this.isArrayTexture = !!(t && t.depth && t.depth > 1), this.pmremVersion = 0;
		}
		get width() {
			return this.source.getSize(Me).x;
		}
		get height() {
			return this.source.getSize(Me).y;
		}
		get depth() {
			return this.source.getSize(Me).z;
		}
		get image() {
			return this.source.data;
		}
		set image(t = null) {
			this.source.data = t;
		}
		updateMatrix() {
			this.matrix.setUvTransform(this.offset.x, this.offset.y, this.repeat.x, this.repeat.y, this.rotation, this.center.x, this.center.y);
		}
		addUpdateRange(t, e) {
			this.updateRanges.push({
				start: t,
				count: e
			});
		}
		clearUpdateRanges() {
			this.updateRanges.length = 0;
		}
		clone() {
			return new this.constructor().copy(this);
		}
		copy(t) {
			return this.name = t.name, this.source = t.source, this.mipmaps = t.mipmaps.slice(0), this.mapping = t.mapping, this.channel = t.channel, this.wrapS = t.wrapS, this.wrapT = t.wrapT, this.magFilter = t.magFilter, this.minFilter = t.minFilter, this.anisotropy = t.anisotropy, this.format = t.format, this.internalFormat = t.internalFormat, this.type = t.type, this.offset.copy(t.offset), this.repeat.copy(t.repeat), this.center.copy(t.center), this.rotation = t.rotation, this.matrixAutoUpdate = t.matrixAutoUpdate, this.matrix.copy(t.matrix), this.generateMipmaps = t.generateMipmaps, this.premultiplyAlpha = t.premultiplyAlpha, this.flipY = t.flipY, this.unpackAlignment = t.unpackAlignment, this.colorSpace = t.colorSpace, this.renderTarget = t.renderTarget, this.isRenderTargetTexture = t.isRenderTargetTexture, this.isArrayTexture = t.isArrayTexture, this.userData = JSON.parse(JSON.stringify(t.userData)), this.needsUpdate = !0, this;
		}
		setValues(t) {
			for (const e in t) {
				const s = t[e];
				if (s === void 0) {
					F(`Texture.setValues(): parameter '${e}' has value of undefined.`);
					continue;
				}
				const r = this[e];
				if (r === void 0) {
					F(`Texture.setValues(): property '${e}' does not exist.`);
					continue;
				}
				r && s && r.isVector2 && s.isVector2 || r && s && r.isVector3 && s.isVector3 || r && s && r.isMatrix3 && s.isMatrix3 ? r.copy(s) : this[e] = s;
			}
		}
		toJSON(t) {
			const e = t === void 0 || typeof t == "string";
			if (!e && t.textures[this.uuid] !== void 0) return t.textures[this.uuid];
			const s = {
				metadata: {
					version: 4.7,
					type: "Texture",
					generator: "Texture.toJSON"
				},
				uuid: this.uuid,
				name: this.name,
				image: this.source.toJSON(t).uuid,
				mapping: this.mapping,
				channel: this.channel,
				repeat: [this.repeat.x, this.repeat.y],
				offset: [this.offset.x, this.offset.y],
				center: [this.center.x, this.center.y],
				rotation: this.rotation,
				wrap: [this.wrapS, this.wrapT],
				format: this.format,
				internalFormat: this.internalFormat,
				type: this.type,
				colorSpace: this.colorSpace,
				minFilter: this.minFilter,
				magFilter: this.magFilter,
				anisotropy: this.anisotropy,
				flipY: this.flipY,
				generateMipmaps: this.generateMipmaps,
				premultiplyAlpha: this.premultiplyAlpha,
				unpackAlignment: this.unpackAlignment
			};
			return Object.keys(this.userData).length > 0 && (s.userData = this.userData), e || (t.textures[this.uuid] = s), s;
		}
		dispose() {
			this.dispatchEvent({ type: "dispose" });
		}
		transformUv(t) {
			if (this.mapping !== 300) return t;
			if (t.applyMatrix3(this.matrix), t.x < 0 || t.x > 1) switch (this.wrapS) {
				case 1e3:
					t.x = t.x - Math.floor(t.x);
					break;
				case 1001:
					t.x = t.x < 0 ? 0 : 1;
					break;
				case 1002:
					Math.abs(Math.floor(t.x) % 2) === 1 ? t.x = Math.ceil(t.x) - t.x : t.x = t.x - Math.floor(t.x);
					break;
			}
			if (t.y < 0 || t.y > 1) switch (this.wrapT) {
				case 1e3:
					t.y = t.y - Math.floor(t.y);
					break;
				case 1001:
					t.y = t.y < 0 ? 0 : 1;
					break;
				case 1002:
					Math.abs(Math.floor(t.y) % 2) === 1 ? t.y = Math.ceil(t.y) - t.y : t.y = t.y - Math.floor(t.y);
					break;
			}
			return this.flipY && (t.y = 1 - t.y), t;
		}
		set needsUpdate(t) {
			t === !0 && (this.version++, this.source.needsUpdate = !0);
		}
		set needsPMREMUpdate(t) {
			t === !0 && this.pmremVersion++;
		}
	};
	_e.DEFAULT_IMAGE = null, _e.DEFAULT_MAPPING = 300, _e.DEFAULT_ANISOTROPY = 1;
	var we = class bi {
		constructor(t = 0, e = 0, s = 0, r = 1) {
			bi.prototype.isVector4 = !0, this.x = t, this.y = e, this.z = s, this.w = r;
		}
		get width() {
			return this.z;
		}
		set width(t) {
			this.z = t;
		}
		get height() {
			return this.w;
		}
		set height(t) {
			this.w = t;
		}
		set(t, e, s, r) {
			return this.x = t, this.y = e, this.z = s, this.w = r, this;
		}
		setScalar(t) {
			return this.x = t, this.y = t, this.z = t, this.w = t, this;
		}
		setX(t) {
			return this.x = t, this;
		}
		setY(t) {
			return this.y = t, this;
		}
		setZ(t) {
			return this.z = t, this;
		}
		setW(t) {
			return this.w = t, this;
		}
		setComponent(t, e) {
			switch (t) {
				case 0:
					this.x = e;
					break;
				case 1:
					this.y = e;
					break;
				case 2:
					this.z = e;
					break;
				case 3:
					this.w = e;
					break;
				default: throw new Error("index is out of range: " + t);
			}
			return this;
		}
		getComponent(t) {
			switch (t) {
				case 0: return this.x;
				case 1: return this.y;
				case 2: return this.z;
				case 3: return this.w;
				default: throw new Error("index is out of range: " + t);
			}
		}
		clone() {
			return new this.constructor(this.x, this.y, this.z, this.w);
		}
		copy(t) {
			return this.x = t.x, this.y = t.y, this.z = t.z, this.w = t.w !== void 0 ? t.w : 1, this;
		}
		add(t) {
			return this.x += t.x, this.y += t.y, this.z += t.z, this.w += t.w, this;
		}
		addScalar(t) {
			return this.x += t, this.y += t, this.z += t, this.w += t, this;
		}
		addVectors(t, e) {
			return this.x = t.x + e.x, this.y = t.y + e.y, this.z = t.z + e.z, this.w = t.w + e.w, this;
		}
		addScaledVector(t, e) {
			return this.x += t.x * e, this.y += t.y * e, this.z += t.z * e, this.w += t.w * e, this;
		}
		sub(t) {
			return this.x -= t.x, this.y -= t.y, this.z -= t.z, this.w -= t.w, this;
		}
		subScalar(t) {
			return this.x -= t, this.y -= t, this.z -= t, this.w -= t, this;
		}
		subVectors(t, e) {
			return this.x = t.x - e.x, this.y = t.y - e.y, this.z = t.z - e.z, this.w = t.w - e.w, this;
		}
		multiply(t) {
			return this.x *= t.x, this.y *= t.y, this.z *= t.z, this.w *= t.w, this;
		}
		multiplyScalar(t) {
			return this.x *= t, this.y *= t, this.z *= t, this.w *= t, this;
		}
		applyMatrix4(t) {
			const e = this.x, s = this.y, r = this.z, n = this.w, o = t.elements;
			return this.x = o[0] * e + o[4] * s + o[8] * r + o[12] * n, this.y = o[1] * e + o[5] * s + o[9] * r + o[13] * n, this.z = o[2] * e + o[6] * s + o[10] * r + o[14] * n, this.w = o[3] * e + o[7] * s + o[11] * r + o[15] * n, this;
		}
		divide(t) {
			return this.x /= t.x, this.y /= t.y, this.z /= t.z, this.w /= t.w, this;
		}
		divideScalar(t) {
			return this.multiplyScalar(1 / t);
		}
		setAxisAngleFromQuaternion(t) {
			this.w = 2 * Math.acos(t.w);
			const e = Math.sqrt(1 - t.w * t.w);
			return e < 1e-4 ? (this.x = 1, this.y = 0, this.z = 0) : (this.x = t.x / e, this.y = t.y / e, this.z = t.z / e), this;
		}
		setAxisAngleFromRotationMatrix(t) {
			let e, s, r, n;
			const l = t.elements, h = l[0], c = l[4], u = l[8], d = l[1], p = l[5], m = l[9], f = l[2], y = l[6], g = l[10];
			if (Math.abs(c - d) < .01 && Math.abs(u - f) < .01 && Math.abs(m - y) < .01) {
				if (Math.abs(c + d) < .1 && Math.abs(u + f) < .1 && Math.abs(m + y) < .1 && Math.abs(h + p + g - 3) < .1) return this.set(1, 0, 0, 0), this;
				e = Math.PI;
				const _ = (h + 1) / 2, M = (p + 1) / 2, w = (g + 1) / 2, z = (c + d) / 4, S = (u + f) / 4, A = (m + y) / 4;
				return _ > M && _ > w ? _ < .01 ? (s = 0, r = .707106781, n = .707106781) : (s = Math.sqrt(_), r = z / s, n = S / s) : M > w ? M < .01 ? (s = .707106781, r = 0, n = .707106781) : (r = Math.sqrt(M), s = z / r, n = A / r) : w < .01 ? (s = .707106781, r = .707106781, n = 0) : (n = Math.sqrt(w), s = S / n, r = A / n), this.set(s, r, n, e), this;
			}
			let b = Math.sqrt((y - m) * (y - m) + (u - f) * (u - f) + (d - c) * (d - c));
			return Math.abs(b) < .001 && (b = 1), this.x = (y - m) / b, this.y = (u - f) / b, this.z = (d - c) / b, this.w = Math.acos((h + p + g - 1) / 2), this;
		}
		setFromMatrixPosition(t) {
			const e = t.elements;
			return this.x = e[12], this.y = e[13], this.z = e[14], this.w = e[15], this;
		}
		min(t) {
			return this.x = Math.min(this.x, t.x), this.y = Math.min(this.y, t.y), this.z = Math.min(this.z, t.z), this.w = Math.min(this.w, t.w), this;
		}
		max(t) {
			return this.x = Math.max(this.x, t.x), this.y = Math.max(this.y, t.y), this.z = Math.max(this.z, t.z), this.w = Math.max(this.w, t.w), this;
		}
		clamp(t, e) {
			return this.x = C(this.x, t.x, e.x), this.y = C(this.y, t.y, e.y), this.z = C(this.z, t.z, e.z), this.w = C(this.w, t.w, e.w), this;
		}
		clampScalar(t, e) {
			return this.x = C(this.x, t, e), this.y = C(this.y, t, e), this.z = C(this.z, t, e), this.w = C(this.w, t, e), this;
		}
		clampLength(t, e) {
			const s = this.length();
			return this.divideScalar(s || 1).multiplyScalar(C(s, t, e));
		}
		floor() {
			return this.x = Math.floor(this.x), this.y = Math.floor(this.y), this.z = Math.floor(this.z), this.w = Math.floor(this.w), this;
		}
		ceil() {
			return this.x = Math.ceil(this.x), this.y = Math.ceil(this.y), this.z = Math.ceil(this.z), this.w = Math.ceil(this.w), this;
		}
		round() {
			return this.x = Math.round(this.x), this.y = Math.round(this.y), this.z = Math.round(this.z), this.w = Math.round(this.w), this;
		}
		roundToZero() {
			return this.x = Math.trunc(this.x), this.y = Math.trunc(this.y), this.z = Math.trunc(this.z), this.w = Math.trunc(this.w), this;
		}
		negate() {
			return this.x = -this.x, this.y = -this.y, this.z = -this.z, this.w = -this.w, this;
		}
		dot(t) {
			return this.x * t.x + this.y * t.y + this.z * t.z + this.w * t.w;
		}
		lengthSq() {
			return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
		}
		length() {
			return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
		}
		manhattanLength() {
			return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z) + Math.abs(this.w);
		}
		normalize() {
			return this.divideScalar(this.length() || 1);
		}
		setLength(t) {
			return this.normalize().multiplyScalar(t);
		}
		lerp(t, e) {
			return this.x += (t.x - this.x) * e, this.y += (t.y - this.y) * e, this.z += (t.z - this.z) * e, this.w += (t.w - this.w) * e, this;
		}
		lerpVectors(t, e, s) {
			return this.x = t.x + (e.x - t.x) * s, this.y = t.y + (e.y - t.y) * s, this.z = t.z + (e.z - t.z) * s, this.w = t.w + (e.w - t.w) * s, this;
		}
		equals(t) {
			return t.x === this.x && t.y === this.y && t.z === this.z && t.w === this.w;
		}
		fromArray(t, e = 0) {
			return this.x = t[e], this.y = t[e + 1], this.z = t[e + 2], this.w = t[e + 3], this;
		}
		toArray(t = [], e = 0) {
			return t[e] = this.x, t[e + 1] = this.y, t[e + 2] = this.z, t[e + 3] = this.w, t;
		}
		fromBufferAttribute(t, e) {
			return this.x = t.getX(e), this.y = t.getY(e), this.z = t.getZ(e), this.w = t.getW(e), this;
		}
		random() {
			return this.x = Math.random(), this.y = Math.random(), this.z = Math.random(), this.w = Math.random(), this;
		}
		*[Symbol.iterator]() {
			yield this.x, yield this.y, yield this.z, yield this.w;
		}
	}, rt = class qe {
		constructor(t, e, s, r, n, o, a, l, h, c, u, d, p, m, f, y) {
			qe.prototype.isMatrix4 = !0, this.elements = [
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1
			], t !== void 0 && this.set(t, e, s, r, n, o, a, l, h, c, u, d, p, m, f, y);
		}
		set(t, e, s, r, n, o, a, l, h, c, u, d, p, m, f, y) {
			const g = this.elements;
			return g[0] = t, g[4] = e, g[8] = s, g[12] = r, g[1] = n, g[5] = o, g[9] = a, g[13] = l, g[2] = h, g[6] = c, g[10] = u, g[14] = d, g[3] = p, g[7] = m, g[11] = f, g[15] = y, this;
		}
		identity() {
			return this.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1), this;
		}
		clone() {
			return new qe().fromArray(this.elements);
		}
		copy(t) {
			const e = this.elements, s = t.elements;
			return e[0] = s[0], e[1] = s[1], e[2] = s[2], e[3] = s[3], e[4] = s[4], e[5] = s[5], e[6] = s[6], e[7] = s[7], e[8] = s[8], e[9] = s[9], e[10] = s[10], e[11] = s[11], e[12] = s[12], e[13] = s[13], e[14] = s[14], e[15] = s[15], this;
		}
		copyPosition(t) {
			const e = this.elements, s = t.elements;
			return e[12] = s[12], e[13] = s[13], e[14] = s[14], this;
		}
		setFromMatrix3(t) {
			const e = t.elements;
			return this.set(e[0], e[3], e[6], 0, e[1], e[4], e[7], 0, e[2], e[5], e[8], 0, 0, 0, 0, 1), this;
		}
		extractBasis(t, e, s) {
			return this.determinant() === 0 ? (t.set(1, 0, 0), e.set(0, 1, 0), s.set(0, 0, 1), this) : (t.setFromMatrixColumn(this, 0), e.setFromMatrixColumn(this, 1), s.setFromMatrixColumn(this, 2), this);
		}
		makeBasis(t, e, s) {
			return this.set(t.x, e.x, s.x, 0, t.y, e.y, s.y, 0, t.z, e.z, s.z, 0, 0, 0, 0, 1), this;
		}
		extractRotation(t) {
			if (t.determinant() === 0) return this.identity();
			const e = this.elements, s = t.elements, r = 1 / gt.setFromMatrixColumn(t, 0).length(), n = 1 / gt.setFromMatrixColumn(t, 1).length(), o = 1 / gt.setFromMatrixColumn(t, 2).length();
			return e[0] = s[0] * r, e[1] = s[1] * r, e[2] = s[2] * r, e[3] = 0, e[4] = s[4] * n, e[5] = s[5] * n, e[6] = s[6] * n, e[7] = 0, e[8] = s[8] * o, e[9] = s[9] * o, e[10] = s[10] * o, e[11] = 0, e[12] = 0, e[13] = 0, e[14] = 0, e[15] = 1, this;
		}
		makeRotationFromEuler(t) {
			const e = this.elements, s = t.x, r = t.y, n = t.z, o = Math.cos(s), a = Math.sin(s), l = Math.cos(r), h = Math.sin(r), c = Math.cos(n), u = Math.sin(n);
			if (t.order === "XYZ") {
				const d = o * c, p = o * u, m = a * c, f = a * u;
				e[0] = l * c, e[4] = -l * u, e[8] = h, e[1] = p + m * h, e[5] = d - f * h, e[9] = -a * l, e[2] = f - d * h, e[6] = m + p * h, e[10] = o * l;
			} else if (t.order === "YXZ") {
				const d = l * c, p = l * u, m = h * c, f = h * u;
				e[0] = d + f * a, e[4] = m * a - p, e[8] = o * h, e[1] = o * u, e[5] = o * c, e[9] = -a, e[2] = p * a - m, e[6] = f + d * a, e[10] = o * l;
			} else if (t.order === "ZXY") {
				const d = l * c, p = l * u, m = h * c, f = h * u;
				e[0] = d - f * a, e[4] = -o * u, e[8] = m + p * a, e[1] = p + m * a, e[5] = o * c, e[9] = f - d * a, e[2] = -o * h, e[6] = a, e[10] = o * l;
			} else if (t.order === "ZYX") {
				const d = o * c, p = o * u, m = a * c, f = a * u;
				e[0] = l * c, e[4] = m * h - p, e[8] = d * h + f, e[1] = l * u, e[5] = f * h + d, e[9] = p * h - m, e[2] = -h, e[6] = a * l, e[10] = o * l;
			} else if (t.order === "YZX") {
				const d = o * l, p = o * h, m = a * l, f = a * h;
				e[0] = l * c, e[4] = f - d * u, e[8] = m * u + p, e[1] = u, e[5] = o * c, e[9] = -a * c, e[2] = -h * c, e[6] = p * u + m, e[10] = d - f * u;
			} else if (t.order === "XZY") {
				const d = o * l, p = o * h, m = a * l, f = a * h;
				e[0] = l * c, e[4] = -u, e[8] = h * c, e[1] = d * u + f, e[5] = o * c, e[9] = p * u - m, e[2] = m * u - p, e[6] = a * c, e[10] = f * u + d;
			}
			return e[3] = 0, e[7] = 0, e[11] = 0, e[12] = 0, e[13] = 0, e[14] = 0, e[15] = 1, this;
		}
		makeRotationFromQuaternion(t) {
			return this.compose(Bi, t, Vi);
		}
		lookAt(t, e, s) {
			const r = this.elements;
			return L.subVectors(t, e), L.lengthSq() === 0 && (L.z = 1), L.normalize(), nt.crossVectors(s, L), nt.lengthSq() === 0 && (Math.abs(s.z) === 1 ? L.x += 1e-4 : L.z += 1e-4, L.normalize(), nt.crossVectors(s, L)), nt.normalize(), qt.crossVectors(L, nt), r[0] = nt.x, r[4] = qt.x, r[8] = L.x, r[1] = nt.y, r[5] = qt.y, r[9] = L.y, r[2] = nt.z, r[6] = qt.z, r[10] = L.z, this;
		}
		multiply(t) {
			return this.multiplyMatrices(this, t);
		}
		premultiply(t) {
			return this.multiplyMatrices(t, this);
		}
		multiplyMatrices(t, e) {
			const s = t.elements, r = e.elements, n = this.elements, o = s[0], a = s[4], l = s[8], h = s[12], c = s[1], u = s[5], d = s[9], p = s[13], m = s[2], f = s[6], y = s[10], g = s[14], b = s[3], _ = s[7], M = s[11], w = s[15], z = r[0], S = r[4], A = r[8], T = r[12], v = r[1], k = r[5], B = r[9], I = r[13], O = r[2], V = r[6], he = r[10], le = r[14], ce = r[3], ue = r[7], de = r[11], pe = r[15];
			return n[0] = o * z + a * v + l * O + h * ce, n[4] = o * S + a * k + l * V + h * ue, n[8] = o * A + a * B + l * he + h * de, n[12] = o * T + a * I + l * le + h * pe, n[1] = c * z + u * v + d * O + p * ce, n[5] = c * S + u * k + d * V + p * ue, n[9] = c * A + u * B + d * he + p * de, n[13] = c * T + u * I + d * le + p * pe, n[2] = m * z + f * v + y * O + g * ce, n[6] = m * S + f * k + y * V + g * ue, n[10] = m * A + f * B + y * he + g * de, n[14] = m * T + f * I + y * le + g * pe, n[3] = b * z + _ * v + M * O + w * ce, n[7] = b * S + _ * k + M * V + w * ue, n[11] = b * A + _ * B + M * he + w * de, n[15] = b * T + _ * I + M * le + w * pe, this;
		}
		multiplyScalar(t) {
			const e = this.elements;
			return e[0] *= t, e[4] *= t, e[8] *= t, e[12] *= t, e[1] *= t, e[5] *= t, e[9] *= t, e[13] *= t, e[2] *= t, e[6] *= t, e[10] *= t, e[14] *= t, e[3] *= t, e[7] *= t, e[11] *= t, e[15] *= t, this;
		}
		determinant() {
			const t = this.elements, e = t[0], s = t[4], r = t[8], n = t[12], o = t[1], a = t[5], l = t[9], h = t[13], c = t[2], u = t[6], d = t[10], p = t[14], m = t[3], f = t[7], y = t[11], g = t[15], b = l * p - h * d, _ = a * p - h * u, M = a * d - l * u, w = o * p - h * c, z = o * d - l * c, S = o * u - a * c;
			return e * (f * b - y * _ + g * M) - s * (m * b - y * w + g * z) + r * (m * _ - f * w + g * S) - n * (m * M - f * z + y * S);
		}
		transpose() {
			const t = this.elements;
			let e;
			return e = t[1], t[1] = t[4], t[4] = e, e = t[2], t[2] = t[8], t[8] = e, e = t[6], t[6] = t[9], t[9] = e, e = t[3], t[3] = t[12], t[12] = e, e = t[7], t[7] = t[13], t[13] = e, e = t[11], t[11] = t[14], t[14] = e, this;
		}
		setPosition(t, e, s) {
			const r = this.elements;
			return t.isVector3 ? (r[12] = t.x, r[13] = t.y, r[14] = t.z) : (r[12] = t, r[13] = e, r[14] = s), this;
		}
		invert() {
			const t = this.elements, e = t[0], s = t[1], r = t[2], n = t[3], o = t[4], a = t[5], l = t[6], h = t[7], c = t[8], u = t[9], d = t[10], p = t[11], m = t[12], f = t[13], y = t[14], g = t[15], b = e * a - s * o, _ = e * l - r * o, M = e * h - n * o, w = s * l - r * a, z = s * h - n * a, S = r * h - n * l, A = c * f - u * m, T = c * y - d * m, v = c * g - p * m, k = u * y - d * f, B = u * g - p * f, I = d * g - p * y, O = b * I - _ * B + M * k + w * v - z * T + S * A;
			if (O === 0) return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
			const V = 1 / O;
			return t[0] = (a * I - l * B + h * k) * V, t[1] = (r * B - s * I - n * k) * V, t[2] = (f * S - y * z + g * w) * V, t[3] = (d * z - u * S - p * w) * V, t[4] = (l * v - o * I - h * T) * V, t[5] = (e * I - r * v + n * T) * V, t[6] = (y * M - m * S - g * _) * V, t[7] = (c * S - d * M + p * _) * V, t[8] = (o * B - a * v + h * A) * V, t[9] = (s * v - e * B - n * A) * V, t[10] = (m * z - f * M + g * b) * V, t[11] = (u * M - c * z - p * b) * V, t[12] = (a * T - o * k - l * A) * V, t[13] = (e * k - s * T + r * A) * V, t[14] = (f * _ - m * w - y * b) * V, t[15] = (c * w - u * _ + d * b) * V, this;
		}
		scale(t) {
			const e = this.elements, s = t.x, r = t.y, n = t.z;
			return e[0] *= s, e[4] *= r, e[8] *= n, e[1] *= s, e[5] *= r, e[9] *= n, e[2] *= s, e[6] *= r, e[10] *= n, e[3] *= s, e[7] *= r, e[11] *= n, this;
		}
		getMaxScaleOnAxis() {
			const t = this.elements, e = t[0] * t[0] + t[1] * t[1] + t[2] * t[2], s = t[4] * t[4] + t[5] * t[5] + t[6] * t[6], r = t[8] * t[8] + t[9] * t[9] + t[10] * t[10];
			return Math.sqrt(Math.max(e, s, r));
		}
		makeTranslation(t, e, s) {
			return t.isVector3 ? this.set(1, 0, 0, t.x, 0, 1, 0, t.y, 0, 0, 1, t.z, 0, 0, 0, 1) : this.set(1, 0, 0, t, 0, 1, 0, e, 0, 0, 1, s, 0, 0, 0, 1), this;
		}
		makeRotationX(t) {
			const e = Math.cos(t), s = Math.sin(t);
			return this.set(1, 0, 0, 0, 0, e, -s, 0, 0, s, e, 0, 0, 0, 0, 1), this;
		}
		makeRotationY(t) {
			const e = Math.cos(t), s = Math.sin(t);
			return this.set(e, 0, s, 0, 0, 1, 0, 0, -s, 0, e, 0, 0, 0, 0, 1), this;
		}
		makeRotationZ(t) {
			const e = Math.cos(t), s = Math.sin(t);
			return this.set(e, -s, 0, 0, s, e, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1), this;
		}
		makeRotationAxis(t, e) {
			const s = Math.cos(e), r = Math.sin(e), n = 1 - s, o = t.x, a = t.y, l = t.z, h = n * o, c = n * a;
			return this.set(h * o + s, h * a - r * l, h * l + r * a, 0, h * a + r * l, c * a + s, c * l - r * o, 0, h * l - r * a, c * l + r * o, n * l * l + s, 0, 0, 0, 0, 1), this;
		}
		makeScale(t, e, s) {
			return this.set(t, 0, 0, 0, 0, e, 0, 0, 0, 0, s, 0, 0, 0, 0, 1), this;
		}
		makeShear(t, e, s, r, n, o) {
			return this.set(1, s, n, 0, t, 1, o, 0, e, r, 1, 0, 0, 0, 0, 1), this;
		}
		compose(t, e, s) {
			const r = this.elements, n = e._x, o = e._y, a = e._z, l = e._w, h = n + n, c = o + o, u = a + a, d = n * h, p = n * c, m = n * u, f = o * c, y = o * u, g = a * u, b = l * h, _ = l * c, M = l * u, w = s.x, z = s.y, S = s.z;
			return r[0] = (1 - (f + g)) * w, r[1] = (p + M) * w, r[2] = (m - _) * w, r[3] = 0, r[4] = (p - M) * z, r[5] = (1 - (d + g)) * z, r[6] = (y + b) * z, r[7] = 0, r[8] = (m + _) * S, r[9] = (y - b) * S, r[10] = (1 - (d + f)) * S, r[11] = 0, r[12] = t.x, r[13] = t.y, r[14] = t.z, r[15] = 1, this;
		}
		decompose(t, e, s) {
			const r = this.elements;
			t.x = r[12], t.y = r[13], t.z = r[14];
			const n = this.determinant();
			if (n === 0) return s.set(1, 1, 1), e.identity(), this;
			let o = gt.set(r[0], r[1], r[2]).length();
			const a = gt.set(r[4], r[5], r[6]).length(), l = gt.set(r[8], r[9], r[10]).length();
			n < 0 && (o = -o), Z.copy(this);
			const h = 1 / o, c = 1 / a, u = 1 / l;
			return Z.elements[0] *= h, Z.elements[1] *= h, Z.elements[2] *= h, Z.elements[4] *= c, Z.elements[5] *= c, Z.elements[6] *= c, Z.elements[8] *= u, Z.elements[9] *= u, Z.elements[10] *= u, e.setFromRotationMatrix(Z), s.x = o, s.y = a, s.z = l, this;
		}
		makePerspective(t, e, s, r, n, o, a = 2e3, l = !1) {
			const h = this.elements, c = 2 * n / (e - t), u = 2 * n / (s - r), d = (e + t) / (e - t), p = (s + r) / (s - r);
			let m, f;
			if (l) m = n / (o - n), f = o * n / (o - n);
			else if (a === 2e3) m = -(o + n) / (o - n), f = -2 * o * n / (o - n);
			else if (a === 2001) m = -o / (o - n), f = -o * n / (o - n);
			else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: " + a);
			return h[0] = c, h[4] = 0, h[8] = d, h[12] = 0, h[1] = 0, h[5] = u, h[9] = p, h[13] = 0, h[2] = 0, h[6] = 0, h[10] = m, h[14] = f, h[3] = 0, h[7] = 0, h[11] = -1, h[15] = 0, this;
		}
		makeOrthographic(t, e, s, r, n, o, a = 2e3, l = !1) {
			const h = this.elements, c = 2 / (e - t), u = 2 / (s - r), d = -(e + t) / (e - t), p = -(s + r) / (s - r);
			let m, f;
			if (l) m = 1 / (o - n), f = o / (o - n);
			else if (a === 2e3) m = -2 / (o - n), f = -(o + n) / (o - n);
			else if (a === 2001) m = -1 / (o - n), f = -n / (o - n);
			else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: " + a);
			return h[0] = c, h[4] = 0, h[8] = 0, h[12] = d, h[1] = 0, h[5] = u, h[9] = 0, h[13] = p, h[2] = 0, h[6] = 0, h[10] = m, h[14] = f, h[3] = 0, h[7] = 0, h[11] = 0, h[15] = 1, this;
		}
		equals(t) {
			const e = this.elements, s = t.elements;
			for (let r = 0; r < 16; r++) if (e[r] !== s[r]) return !1;
			return !0;
		}
		fromArray(t, e = 0) {
			for (let s = 0; s < 16; s++) this.elements[s] = t[s + e];
			return this;
		}
		toArray(t = [], e = 0) {
			const s = this.elements;
			return t[e] = s[0], t[e + 1] = s[1], t[e + 2] = s[2], t[e + 3] = s[3], t[e + 4] = s[4], t[e + 5] = s[5], t[e + 6] = s[6], t[e + 7] = s[7], t[e + 8] = s[8], t[e + 9] = s[9], t[e + 10] = s[10], t[e + 11] = s[11], t[e + 12] = s[12], t[e + 13] = s[13], t[e + 14] = s[14], t[e + 15] = s[15], t;
		}
	};
	const gt = new x(), Z = new rt(), Bi = new x(0, 0, 0), Vi = new x(1, 1, 1), nt = new x(), qt = new x(), L = new x(), Ke = new rt(), ti = new pt();
	var ze = class Mi {
		constructor(t = 0, e = 0, s = 0, r = Mi.DEFAULT_ORDER) {
			this.isEuler = !0, this._x = t, this._y = e, this._z = s, this._order = r;
		}
		get x() {
			return this._x;
		}
		set x(t) {
			this._x = t, this._onChangeCallback();
		}
		get y() {
			return this._y;
		}
		set y(t) {
			this._y = t, this._onChangeCallback();
		}
		get z() {
			return this._z;
		}
		set z(t) {
			this._z = t, this._onChangeCallback();
		}
		get order() {
			return this._order;
		}
		set order(t) {
			this._order = t, this._onChangeCallback();
		}
		set(t, e, s, r = this._order) {
			return this._x = t, this._y = e, this._z = s, this._order = r, this._onChangeCallback(), this;
		}
		clone() {
			return new this.constructor(this._x, this._y, this._z, this._order);
		}
		copy(t) {
			return this._x = t._x, this._y = t._y, this._z = t._z, this._order = t._order, this._onChangeCallback(), this;
		}
		setFromRotationMatrix(t, e = this._order, s = !0) {
			const r = t.elements, n = r[0], o = r[4], a = r[8], l = r[1], h = r[5], c = r[9], u = r[2], d = r[6], p = r[10];
			switch (e) {
				case "XYZ":
					this._y = Math.asin(C(a, -1, 1)), Math.abs(a) < .9999999 ? (this._x = Math.atan2(-c, p), this._z = Math.atan2(-o, n)) : (this._x = Math.atan2(d, h), this._z = 0);
					break;
				case "YXZ":
					this._x = Math.asin(-C(c, -1, 1)), Math.abs(c) < .9999999 ? (this._y = Math.atan2(a, p), this._z = Math.atan2(l, h)) : (this._y = Math.atan2(-u, n), this._z = 0);
					break;
				case "ZXY":
					this._x = Math.asin(C(d, -1, 1)), Math.abs(d) < .9999999 ? (this._y = Math.atan2(-u, p), this._z = Math.atan2(-o, h)) : (this._y = 0, this._z = Math.atan2(l, n));
					break;
				case "ZYX":
					this._y = Math.asin(-C(u, -1, 1)), Math.abs(u) < .9999999 ? (this._x = Math.atan2(d, p), this._z = Math.atan2(l, n)) : (this._x = 0, this._z = Math.atan2(-o, h));
					break;
				case "YZX":
					this._z = Math.asin(C(l, -1, 1)), Math.abs(l) < .9999999 ? (this._x = Math.atan2(-c, h), this._y = Math.atan2(-u, n)) : (this._x = 0, this._y = Math.atan2(a, p));
					break;
				case "XZY":
					this._z = Math.asin(-C(o, -1, 1)), Math.abs(o) < .9999999 ? (this._x = Math.atan2(d, h), this._y = Math.atan2(a, n)) : (this._x = Math.atan2(-c, p), this._y = 0);
					break;
				default: F("Euler: .setFromRotationMatrix() encountered an unknown order: " + e);
			}
			return this._order = e, s === !0 && this._onChangeCallback(), this;
		}
		setFromQuaternion(t, e, s) {
			return Ke.makeRotationFromQuaternion(t), this.setFromRotationMatrix(Ke, e, s);
		}
		setFromVector3(t, e = this._order) {
			return this.set(t.x, t.y, t.z, e);
		}
		reorder(t) {
			return ti.setFromEuler(this), this.setFromQuaternion(ti, t);
		}
		equals(t) {
			return t._x === this._x && t._y === this._y && t._z === this._z && t._order === this._order;
		}
		fromArray(t) {
			return this._x = t[0], this._y = t[1], this._z = t[2], t[3] !== void 0 && (this._order = t[3]), this._onChangeCallback(), this;
		}
		toArray(t = [], e = 0) {
			return t[e] = this._x, t[e + 1] = this._y, t[e + 2] = this._z, t[e + 3] = this._order, t;
		}
		_onChange(t) {
			return this._onChangeCallback = t, this;
		}
		_onChangeCallback() {}
		*[Symbol.iterator]() {
			yield this._x, yield this._y, yield this._z, yield this._order;
		}
	};
	ze.DEFAULT_ORDER = "XYZ";
	var Ei = class {
		constructor() {
			this.mask = 1;
		}
		set(i) {
			this.mask = (1 << i | 0) >>> 0;
		}
		enable(i) {
			this.mask |= 1 << i | 0;
		}
		enableAll() {
			this.mask = -1;
		}
		toggle(i) {
			this.mask ^= 1 << i | 0;
		}
		disable(i) {
			this.mask &= ~(1 << i | 0);
		}
		disableAll() {
			this.mask = 0;
		}
		test(i) {
			return (this.mask & i.mask) !== 0;
		}
		isEnabled(i) {
			return (this.mask & (1 << i | 0)) !== 0;
		}
	};
	let Ni = 0;
	const ei = new x(), xt = new pt(), K = new rt(), jt = new x(), Bt = new x(), Oi = new x(), Ri = new pt(), ii = new x(1, 0, 0), si = new x(0, 1, 0), ri = new x(0, 0, 1), ni = { type: "added" }, Fi = { type: "removed" }, bt = {
		type: "childadded",
		child: null
	}, Se = {
		type: "childremoved",
		child: null
	};
	var Vt = class fe extends Lt {
		constructor() {
			super(), this.isObject3D = !0, Object.defineProperty(this, "id", { value: Ni++ }), this.uuid = kt(), this.name = "", this.type = "Object3D", this.parent = null, this.children = [], this.up = fe.DEFAULT_UP.clone();
			const t = new x(), e = new ze(), s = new pt(), r = new x(1, 1, 1);
			function n() {
				s.setFromEuler(e, !1);
			}
			function o() {
				e.setFromQuaternion(s, void 0, !1);
			}
			e._onChange(n), s._onChange(o), Object.defineProperties(this, {
				position: {
					configurable: !0,
					enumerable: !0,
					value: t
				},
				rotation: {
					configurable: !0,
					enumerable: !0,
					value: e
				},
				quaternion: {
					configurable: !0,
					enumerable: !0,
					value: s
				},
				scale: {
					configurable: !0,
					enumerable: !0,
					value: r
				},
				modelViewMatrix: { value: new rt() },
				normalMatrix: { value: new mt() }
			}), this.matrix = new rt(), this.matrixWorld = new rt(), this.matrixAutoUpdate = fe.DEFAULT_MATRIX_AUTO_UPDATE, this.matrixWorldAutoUpdate = fe.DEFAULT_MATRIX_WORLD_AUTO_UPDATE, this.matrixWorldNeedsUpdate = !1, this.layers = new Ei(), this.visible = !0, this.castShadow = !1, this.receiveShadow = !1, this.frustumCulled = !0, this.renderOrder = 0, this.animations = [], this.customDepthMaterial = void 0, this.customDistanceMaterial = void 0, this.static = !1, this.userData = {}, this.pivot = null;
		}
		onBeforeShadow() {}
		onAfterShadow() {}
		onBeforeRender() {}
		onAfterRender() {}
		applyMatrix4(t) {
			this.matrixAutoUpdate && this.updateMatrix(), this.matrix.premultiply(t), this.matrix.decompose(this.position, this.quaternion, this.scale);
		}
		applyQuaternion(t) {
			return this.quaternion.premultiply(t), this;
		}
		setRotationFromAxisAngle(t, e) {
			this.quaternion.setFromAxisAngle(t, e);
		}
		setRotationFromEuler(t) {
			this.quaternion.setFromEuler(t, !0);
		}
		setRotationFromMatrix(t) {
			this.quaternion.setFromRotationMatrix(t);
		}
		setRotationFromQuaternion(t) {
			this.quaternion.copy(t);
		}
		rotateOnAxis(t, e) {
			return xt.setFromAxisAngle(t, e), this.quaternion.multiply(xt), this;
		}
		rotateOnWorldAxis(t, e) {
			return xt.setFromAxisAngle(t, e), this.quaternion.premultiply(xt), this;
		}
		rotateX(t) {
			return this.rotateOnAxis(ii, t);
		}
		rotateY(t) {
			return this.rotateOnAxis(si, t);
		}
		rotateZ(t) {
			return this.rotateOnAxis(ri, t);
		}
		translateOnAxis(t, e) {
			return ei.copy(t).applyQuaternion(this.quaternion), this.position.add(ei.multiplyScalar(e)), this;
		}
		translateX(t) {
			return this.translateOnAxis(ii, t);
		}
		translateY(t) {
			return this.translateOnAxis(si, t);
		}
		translateZ(t) {
			return this.translateOnAxis(ri, t);
		}
		localToWorld(t) {
			return this.updateWorldMatrix(!0, !1), t.applyMatrix4(this.matrixWorld);
		}
		worldToLocal(t) {
			return this.updateWorldMatrix(!0, !1), t.applyMatrix4(K.copy(this.matrixWorld).invert());
		}
		lookAt(t, e, s) {
			t.isVector3 ? jt.copy(t) : jt.set(t, e, s);
			const r = this.parent;
			this.updateWorldMatrix(!0, !1), Bt.setFromMatrixPosition(this.matrixWorld), this.isCamera || this.isLight ? K.lookAt(Bt, jt, this.up) : K.lookAt(jt, Bt, this.up), this.quaternion.setFromRotationMatrix(K), r && (K.extractRotation(r.matrixWorld), xt.setFromRotationMatrix(K), this.quaternion.premultiply(xt.invert()));
		}
		add(t) {
			if (arguments.length > 1) {
				for (let e = 0; e < arguments.length; e++) this.add(arguments[e]);
				return this;
			}
			return t === this ? (E("Object3D.add: object can't be added as a child of itself.", t), this) : (t && t.isObject3D ? (t.removeFromParent(), t.parent = this, this.children.push(t), t.dispatchEvent(ni), bt.child = t, this.dispatchEvent(bt), bt.child = null) : E("Object3D.add: object not an instance of THREE.Object3D.", t), this);
		}
		remove(t) {
			if (arguments.length > 1) {
				for (let s = 0; s < arguments.length; s++) this.remove(arguments[s]);
				return this;
			}
			const e = this.children.indexOf(t);
			return e !== -1 && (t.parent = null, this.children.splice(e, 1), t.dispatchEvent(Fi), Se.child = t, this.dispatchEvent(Se), Se.child = null), this;
		}
		removeFromParent() {
			const t = this.parent;
			return t !== null && t.remove(this), this;
		}
		clear() {
			return this.remove(...this.children);
		}
		attach(t) {
			return this.updateWorldMatrix(!0, !1), K.copy(this.matrixWorld).invert(), t.parent !== null && (t.parent.updateWorldMatrix(!0, !1), K.multiply(t.parent.matrixWorld)), t.applyMatrix4(K), t.removeFromParent(), t.parent = this, this.children.push(t), t.updateWorldMatrix(!1, !0), t.dispatchEvent(ni), bt.child = t, this.dispatchEvent(bt), bt.child = null, this;
		}
		getObjectById(t) {
			return this.getObjectByProperty("id", t);
		}
		getObjectByName(t) {
			return this.getObjectByProperty("name", t);
		}
		getObjectByProperty(t, e) {
			if (this[t] === e) return this;
			for (let s = 0, r = this.children.length; s < r; s++) {
				const n = this.children[s].getObjectByProperty(t, e);
				if (n !== void 0) return n;
			}
		}
		getObjectsByProperty(t, e, s = []) {
			this[t] === e && s.push(this);
			const r = this.children;
			for (let n = 0, o = r.length; n < o; n++) r[n].getObjectsByProperty(t, e, s);
			return s;
		}
		getWorldPosition(t) {
			return this.updateWorldMatrix(!0, !1), t.setFromMatrixPosition(this.matrixWorld);
		}
		getWorldQuaternion(t) {
			return this.updateWorldMatrix(!0, !1), this.matrixWorld.decompose(Bt, t, Oi), t;
		}
		getWorldScale(t) {
			return this.updateWorldMatrix(!0, !1), this.matrixWorld.decompose(Bt, Ri, t), t;
		}
		getWorldDirection(t) {
			this.updateWorldMatrix(!0, !1);
			const e = this.matrixWorld.elements;
			return t.set(e[8], e[9], e[10]).normalize();
		}
		raycast() {}
		traverse(t) {
			t(this);
			const e = this.children;
			for (let s = 0, r = e.length; s < r; s++) e[s].traverse(t);
		}
		traverseVisible(t) {
			if (this.visible === !1) return;
			t(this);
			const e = this.children;
			for (let s = 0, r = e.length; s < r; s++) e[s].traverseVisible(t);
		}
		traverseAncestors(t) {
			const e = this.parent;
			e !== null && (t(e), e.traverseAncestors(t));
		}
		updateMatrix() {
			this.matrix.compose(this.position, this.quaternion, this.scale);
			const t = this.pivot;
			if (t !== null) {
				const e = t.x, s = t.y, r = t.z, n = this.matrix.elements;
				n[12] += e - n[0] * e - n[4] * s - n[8] * r, n[13] += s - n[1] * e - n[5] * s - n[9] * r, n[14] += r - n[2] * e - n[6] * s - n[10] * r;
			}
			this.matrixWorldNeedsUpdate = !0;
		}
		updateMatrixWorld(t) {
			this.matrixAutoUpdate && this.updateMatrix(), (this.matrixWorldNeedsUpdate || t) && (this.matrixWorldAutoUpdate === !0 && (this.parent === null ? this.matrixWorld.copy(this.matrix) : this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix)), this.matrixWorldNeedsUpdate = !1, t = !0);
			const e = this.children;
			for (let s = 0, r = e.length; s < r; s++) e[s].updateMatrixWorld(t);
		}
		updateWorldMatrix(t, e) {
			const s = this.parent;
			if (t === !0 && s !== null && s.updateWorldMatrix(!0, !1), this.matrixAutoUpdate && this.updateMatrix(), this.matrixWorldAutoUpdate === !0 && (this.parent === null ? this.matrixWorld.copy(this.matrix) : this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix)), e === !0) {
				const r = this.children;
				for (let n = 0, o = r.length; n < o; n++) r[n].updateWorldMatrix(!1, !0);
			}
		}
		toJSON(t) {
			const e = t === void 0 || typeof t == "string", s = {};
			e && (t = {
				geometries: {},
				materials: {},
				textures: {},
				images: {},
				shapes: {},
				skeletons: {},
				animations: {},
				nodes: {}
			}, s.metadata = {
				version: 4.7,
				type: "Object",
				generator: "Object3D.toJSON"
			});
			const r = {};
			r.uuid = this.uuid, r.type = this.type, this.name !== "" && (r.name = this.name), this.castShadow === !0 && (r.castShadow = !0), this.receiveShadow === !0 && (r.receiveShadow = !0), this.visible === !1 && (r.visible = !1), this.frustumCulled === !1 && (r.frustumCulled = !1), this.renderOrder !== 0 && (r.renderOrder = this.renderOrder), this.static !== !1 && (r.static = this.static), Object.keys(this.userData).length > 0 && (r.userData = this.userData), r.layers = this.layers.mask, r.matrix = this.matrix.toArray(), r.up = this.up.toArray(), this.pivot !== null && (r.pivot = this.pivot.toArray()), this.matrixAutoUpdate === !1 && (r.matrixAutoUpdate = !1), this.morphTargetDictionary !== void 0 && (r.morphTargetDictionary = Object.assign({}, this.morphTargetDictionary)), this.morphTargetInfluences !== void 0 && (r.morphTargetInfluences = this.morphTargetInfluences.slice()), this.isInstancedMesh && (r.type = "InstancedMesh", r.count = this.count, r.instanceMatrix = this.instanceMatrix.toJSON(), this.instanceColor !== null && (r.instanceColor = this.instanceColor.toJSON())), this.isBatchedMesh && (r.type = "BatchedMesh", r.perObjectFrustumCulled = this.perObjectFrustumCulled, r.sortObjects = this.sortObjects, r.drawRanges = this._drawRanges, r.reservedRanges = this._reservedRanges, r.geometryInfo = this._geometryInfo.map((a) => ({
				...a,
				boundingBox: a.boundingBox ? a.boundingBox.toJSON() : void 0,
				boundingSphere: a.boundingSphere ? a.boundingSphere.toJSON() : void 0
			})), r.instanceInfo = this._instanceInfo.map((a) => ({ ...a })), r.availableInstanceIds = this._availableInstanceIds.slice(), r.availableGeometryIds = this._availableGeometryIds.slice(), r.nextIndexStart = this._nextIndexStart, r.nextVertexStart = this._nextVertexStart, r.geometryCount = this._geometryCount, r.maxInstanceCount = this._maxInstanceCount, r.maxVertexCount = this._maxVertexCount, r.maxIndexCount = this._maxIndexCount, r.geometryInitialized = this._geometryInitialized, r.matricesTexture = this._matricesTexture.toJSON(t), r.indirectTexture = this._indirectTexture.toJSON(t), this._colorsTexture !== null && (r.colorsTexture = this._colorsTexture.toJSON(t)), this.boundingSphere !== null && (r.boundingSphere = this.boundingSphere.toJSON()), this.boundingBox !== null && (r.boundingBox = this.boundingBox.toJSON()));
			function n(a, l) {
				return a[l.uuid] === void 0 && (a[l.uuid] = l.toJSON(t)), l.uuid;
			}
			if (this.isScene) this.background && (this.background.isColor ? r.background = this.background.toJSON() : this.background.isTexture && (r.background = this.background.toJSON(t).uuid)), this.environment && this.environment.isTexture && this.environment.isRenderTargetTexture !== !0 && (r.environment = this.environment.toJSON(t).uuid);
			else if (this.isMesh || this.isLine || this.isPoints) {
				r.geometry = n(t.geometries, this.geometry);
				const a = this.geometry.parameters;
				if (a !== void 0 && a.shapes !== void 0) {
					const l = a.shapes;
					if (Array.isArray(l)) for (let h = 0, c = l.length; h < c; h++) {
						const u = l[h];
						n(t.shapes, u);
					}
					else n(t.shapes, l);
				}
			}
			if (this.isSkinnedMesh && (r.bindMode = this.bindMode, r.bindMatrix = this.bindMatrix.toArray(), this.skeleton !== void 0 && (n(t.skeletons, this.skeleton), r.skeleton = this.skeleton.uuid)), this.material !== void 0) if (Array.isArray(this.material)) {
				const a = [];
				for (let l = 0, h = this.material.length; l < h; l++) a.push(n(t.materials, this.material[l]));
				r.material = a;
			} else r.material = n(t.materials, this.material);
			if (this.children.length > 0) {
				r.children = [];
				for (let a = 0; a < this.children.length; a++) r.children.push(this.children[a].toJSON(t).object);
			}
			if (this.animations.length > 0) {
				r.animations = [];
				for (let a = 0; a < this.animations.length; a++) {
					const l = this.animations[a];
					r.animations.push(n(t.animations, l));
				}
			}
			if (e) {
				const a = o(t.geometries), l = o(t.materials), h = o(t.textures), c = o(t.images), u = o(t.shapes), d = o(t.skeletons), p = o(t.animations), m = o(t.nodes);
				a.length > 0 && (s.geometries = a), l.length > 0 && (s.materials = l), h.length > 0 && (s.textures = h), c.length > 0 && (s.images = c), u.length > 0 && (s.shapes = u), d.length > 0 && (s.skeletons = d), p.length > 0 && (s.animations = p), m.length > 0 && (s.nodes = m);
			}
			return s.object = r, s;
			function o(a) {
				const l = [];
				for (const h in a) {
					const c = a[h];
					delete c.metadata, l.push(c);
				}
				return l;
			}
		}
		clone(t) {
			return new this.constructor().copy(this, t);
		}
		copy(t, e = !0) {
			if (this.name = t.name, this.up.copy(t.up), this.position.copy(t.position), this.rotation.order = t.rotation.order, this.quaternion.copy(t.quaternion), this.scale.copy(t.scale), t.pivot !== null && (this.pivot = t.pivot.clone()), this.matrix.copy(t.matrix), this.matrixWorld.copy(t.matrixWorld), this.matrixAutoUpdate = t.matrixAutoUpdate, this.matrixWorldAutoUpdate = t.matrixWorldAutoUpdate, this.matrixWorldNeedsUpdate = t.matrixWorldNeedsUpdate, this.layers.mask = t.layers.mask, this.visible = t.visible, this.castShadow = t.castShadow, this.receiveShadow = t.receiveShadow, this.frustumCulled = t.frustumCulled, this.renderOrder = t.renderOrder, this.static = t.static, this.animations = t.animations.slice(), this.userData = JSON.parse(JSON.stringify(t.userData)), e === !0) for (let s = 0; s < t.children.length; s++) {
				const r = t.children[s];
				this.add(r.clone());
			}
			return this;
		}
	};
	Vt.DEFAULT_UP = new x(0, 1, 0), Vt.DEFAULT_MATRIX_AUTO_UPDATE = !0, Vt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE = !0;
	const oi = {
		aliceblue: 15792383,
		antiquewhite: 16444375,
		aqua: 65535,
		aquamarine: 8388564,
		azure: 15794175,
		beige: 16119260,
		bisque: 16770244,
		black: 0,
		blanchedalmond: 16772045,
		blue: 255,
		blueviolet: 9055202,
		brown: 10824234,
		burlywood: 14596231,
		cadetblue: 6266528,
		chartreuse: 8388352,
		chocolate: 13789470,
		coral: 16744272,
		cornflowerblue: 6591981,
		cornsilk: 16775388,
		crimson: 14423100,
		cyan: 65535,
		darkblue: 139,
		darkcyan: 35723,
		darkgoldenrod: 12092939,
		darkgray: 11119017,
		darkgreen: 25600,
		darkgrey: 11119017,
		darkkhaki: 12433259,
		darkmagenta: 9109643,
		darkolivegreen: 5597999,
		darkorange: 16747520,
		darkorchid: 10040012,
		darkred: 9109504,
		darksalmon: 15308410,
		darkseagreen: 9419919,
		darkslateblue: 4734347,
		darkslategray: 3100495,
		darkslategrey: 3100495,
		darkturquoise: 52945,
		darkviolet: 9699539,
		deeppink: 16716947,
		deepskyblue: 49151,
		dimgray: 6908265,
		dimgrey: 6908265,
		dodgerblue: 2003199,
		firebrick: 11674146,
		floralwhite: 16775920,
		forestgreen: 2263842,
		fuchsia: 16711935,
		gainsboro: 14474460,
		ghostwhite: 16316671,
		gold: 16766720,
		goldenrod: 14329120,
		gray: 8421504,
		green: 32768,
		greenyellow: 11403055,
		grey: 8421504,
		honeydew: 15794160,
		hotpink: 16738740,
		indianred: 13458524,
		indigo: 4915330,
		ivory: 16777200,
		khaki: 15787660,
		lavender: 15132410,
		lavenderblush: 16773365,
		lawngreen: 8190976,
		lemonchiffon: 16775885,
		lightblue: 11393254,
		lightcoral: 15761536,
		lightcyan: 14745599,
		lightgoldenrodyellow: 16448210,
		lightgray: 13882323,
		lightgreen: 9498256,
		lightgrey: 13882323,
		lightpink: 16758465,
		lightsalmon: 16752762,
		lightseagreen: 2142890,
		lightskyblue: 8900346,
		lightslategray: 7833753,
		lightslategrey: 7833753,
		lightsteelblue: 11584734,
		lightyellow: 16777184,
		lime: 65280,
		limegreen: 3329330,
		linen: 16445670,
		magenta: 16711935,
		maroon: 8388608,
		mediumaquamarine: 6737322,
		mediumblue: 205,
		mediumorchid: 12211667,
		mediumpurple: 9662683,
		mediumseagreen: 3978097,
		mediumslateblue: 8087790,
		mediumspringgreen: 64154,
		mediumturquoise: 4772300,
		mediumvioletred: 13047173,
		midnightblue: 1644912,
		mintcream: 16121850,
		mistyrose: 16770273,
		moccasin: 16770229,
		navajowhite: 16768685,
		navy: 128,
		oldlace: 16643558,
		olive: 8421376,
		olivedrab: 7048739,
		orange: 16753920,
		orangered: 16729344,
		orchid: 14315734,
		palegoldenrod: 15657130,
		palegreen: 10025880,
		paleturquoise: 11529966,
		palevioletred: 14381203,
		papayawhip: 16773077,
		peachpuff: 16767673,
		peru: 13468991,
		pink: 16761035,
		plum: 14524637,
		powderblue: 11591910,
		purple: 8388736,
		rebeccapurple: 6697881,
		red: 16711680,
		rosybrown: 12357519,
		royalblue: 4286945,
		saddlebrown: 9127187,
		salmon: 16416882,
		sandybrown: 16032864,
		seagreen: 3050327,
		seashell: 16774638,
		sienna: 10506797,
		silver: 12632256,
		skyblue: 8900331,
		slateblue: 6970061,
		slategray: 7372944,
		slategrey: 7372944,
		snow: 16775930,
		springgreen: 65407,
		steelblue: 4620980,
		tan: 13808780,
		teal: 32896,
		thistle: 14204888,
		tomato: 16737095,
		turquoise: 4251856,
		violet: 15631086,
		wheat: 16113331,
		white: 16777215,
		whitesmoke: 16119285,
		yellow: 16776960,
		yellowgreen: 10145074
	}, ot = {
		h: 0,
		s: 0,
		l: 0
	}, Xt = {
		h: 0,
		s: 0,
		l: 0
	};
	function Ae(i, t, e) {
		return e < 0 && (e += 1), e > 1 && (e -= 1), e < 1 / 6 ? i + (t - i) * 6 * e : e < 1 / 2 ? t : e < 2 / 3 ? i + (t - i) * 6 * (2 / 3 - e) : i;
	}
	var Zt = class {
		constructor(i, t, e) {
			return this.isColor = !0, this.r = 1, this.g = 1, this.b = 1, this.set(i, t, e);
		}
		set(i, t, e) {
			if (t === void 0 && e === void 0) {
				const s = i;
				s && s.isColor ? this.copy(s) : typeof s == "number" ? this.setHex(s) : typeof s == "string" && this.setStyle(s);
			} else this.setRGB(i, t, e);
			return this;
		}
		setScalar(i) {
			return this.r = i, this.g = i, this.b = i, this;
		}
		setHex(i, t = J) {
			return i = Math.floor(i), this.r = (i >> 16 & 255) / 255, this.g = (i >> 8 & 255) / 255, this.b = (i & 255) / 255, X.colorSpaceToWorking(this, t), this;
		}
		setRGB(i, t, e, s = X.workingColorSpace) {
			return this.r = i, this.g = t, this.b = e, X.colorSpaceToWorking(this, s), this;
		}
		setHSL(i, t, e, s = X.workingColorSpace) {
			if (i = Ai(i, 1), t = C(t, 0, 1), e = C(e, 0, 1), t === 0) this.r = this.g = this.b = e;
			else {
				const r = e <= .5 ? e * (1 + t) : e + t - e * t, n = 2 * e - r;
				this.r = Ae(n, r, i + 1 / 3), this.g = Ae(n, r, i), this.b = Ae(n, r, i - 1 / 3);
			}
			return X.colorSpaceToWorking(this, s), this;
		}
		setStyle(i, t = J) {
			function e(r) {
				r !== void 0 && parseFloat(r) < 1 && F("Color: Alpha component of " + i + " will be ignored.");
			}
			let s;
			if (s = /^(\w+)\(([^\)]*)\)/.exec(i)) {
				let r;
				const n = s[1], o = s[2];
				switch (n) {
					case "rgb":
					case "rgba":
						if (r = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o)) return e(r[4]), this.setRGB(Math.min(255, parseInt(r[1], 10)) / 255, Math.min(255, parseInt(r[2], 10)) / 255, Math.min(255, parseInt(r[3], 10)) / 255, t);
						if (r = /^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o)) return e(r[4]), this.setRGB(Math.min(100, parseInt(r[1], 10)) / 100, Math.min(100, parseInt(r[2], 10)) / 100, Math.min(100, parseInt(r[3], 10)) / 100, t);
						break;
					case "hsl":
					case "hsla":
						if (r = /^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o)) return e(r[4]), this.setHSL(parseFloat(r[1]) / 360, parseFloat(r[2]) / 100, parseFloat(r[3]) / 100, t);
						break;
					default: F("Color: Unknown color model " + i);
				}
			} else if (s = /^\#([A-Fa-f\d]+)$/.exec(i)) {
				const r = s[1], n = r.length;
				if (n === 3) return this.setRGB(parseInt(r.charAt(0), 16) / 15, parseInt(r.charAt(1), 16) / 15, parseInt(r.charAt(2), 16) / 15, t);
				if (n === 6) return this.setHex(parseInt(r, 16), t);
				F("Color: Invalid hex color " + i);
			} else if (i && i.length > 0) return this.setColorName(i, t);
			return this;
		}
		setColorName(i, t = J) {
			const e = oi[i.toLowerCase()];
			return e !== void 0 ? this.setHex(e, t) : F("Color: Unknown color " + i), this;
		}
		clone() {
			return new this.constructor(this.r, this.g, this.b);
		}
		copy(i) {
			return this.r = i.r, this.g = i.g, this.b = i.b, this;
		}
		copySRGBToLinear(i) {
			return this.r = Q(i.r), this.g = Q(i.g), this.b = Q(i.b), this;
		}
		copyLinearToSRGB(i) {
			return this.r = ft(i.r), this.g = ft(i.g), this.b = ft(i.b), this;
		}
		convertSRGBToLinear() {
			return this.copySRGBToLinear(this), this;
		}
		convertLinearToSRGB() {
			return this.copyLinearToSRGB(this), this;
		}
		getHex(i = J) {
			return X.workingToColorSpace(U.copy(this), i), Math.round(C(U.r * 255, 0, 255)) * 65536 + Math.round(C(U.g * 255, 0, 255)) * 256 + Math.round(C(U.b * 255, 0, 255));
		}
		getHexString(i = J) {
			return ("000000" + this.getHex(i).toString(16)).slice(-6);
		}
		getHSL(i, t = X.workingColorSpace) {
			X.workingToColorSpace(U.copy(this), t);
			const e = U.r, s = U.g, r = U.b, n = Math.max(e, s, r), o = Math.min(e, s, r);
			let a, l;
			const h = (o + n) / 2;
			if (o === n) a = 0, l = 0;
			else {
				const c = n - o;
				switch (l = h <= .5 ? c / (n + o) : c / (2 - n - o), n) {
					case e:
						a = (s - r) / c + (s < r ? 6 : 0);
						break;
					case s:
						a = (r - e) / c + 2;
						break;
					case r:
						a = (e - s) / c + 4;
						break;
				}
				a /= 6;
			}
			return i.h = a, i.s = l, i.l = h, i;
		}
		getRGB(i, t = X.workingColorSpace) {
			return X.workingToColorSpace(U.copy(this), t), i.r = U.r, i.g = U.g, i.b = U.b, i;
		}
		getStyle(i = J) {
			X.workingToColorSpace(U.copy(this), i);
			const t = U.r, e = U.g, s = U.b;
			return i !== "srgb" ? `color(${i} ${t.toFixed(3)} ${e.toFixed(3)} ${s.toFixed(3)})` : `rgb(${Math.round(t * 255)},${Math.round(e * 255)},${Math.round(s * 255)})`;
		}
		offsetHSL(i, t, e) {
			return this.getHSL(ot), this.setHSL(ot.h + i, ot.s + t, ot.l + e);
		}
		add(i) {
			return this.r += i.r, this.g += i.g, this.b += i.b, this;
		}
		addColors(i, t) {
			return this.r = i.r + t.r, this.g = i.g + t.g, this.b = i.b + t.b, this;
		}
		addScalar(i) {
			return this.r += i, this.g += i, this.b += i, this;
		}
		sub(i) {
			return this.r = Math.max(0, this.r - i.r), this.g = Math.max(0, this.g - i.g), this.b = Math.max(0, this.b - i.b), this;
		}
		multiply(i) {
			return this.r *= i.r, this.g *= i.g, this.b *= i.b, this;
		}
		multiplyScalar(i) {
			return this.r *= i, this.g *= i, this.b *= i, this;
		}
		lerp(i, t) {
			return this.r += (i.r - this.r) * t, this.g += (i.g - this.g) * t, this.b += (i.b - this.b) * t, this;
		}
		lerpColors(i, t, e) {
			return this.r = i.r + (t.r - i.r) * e, this.g = i.g + (t.g - i.g) * e, this.b = i.b + (t.b - i.b) * e, this;
		}
		lerpHSL(i, t) {
			this.getHSL(ot), i.getHSL(Xt);
			const e = ye(ot.h, Xt.h, t), s = ye(ot.s, Xt.s, t), r = ye(ot.l, Xt.l, t);
			return this.setHSL(e, s, r), this;
		}
		setFromVector3(i) {
			return this.r = i.x, this.g = i.y, this.b = i.z, this;
		}
		applyMatrix3(i) {
			const t = this.r, e = this.g, s = this.b, r = i.elements;
			return this.r = r[0] * t + r[3] * e + r[6] * s, this.g = r[1] * t + r[4] * e + r[7] * s, this.b = r[2] * t + r[5] * e + r[8] * s, this;
		}
		equals(i) {
			return i.r === this.r && i.g === this.g && i.b === this.b;
		}
		fromArray(i, t = 0) {
			return this.r = i[t], this.g = i[t + 1], this.b = i[t + 2], this;
		}
		toArray(i = [], t = 0) {
			return i[t] = this.r, i[t + 1] = this.g, i[t + 2] = this.b, i;
		}
		fromBufferAttribute(i, t) {
			return this.r = i.getX(t), this.g = i.getY(t), this.b = i.getZ(t), this;
		}
		toJSON() {
			return this.getHex();
		}
		*[Symbol.iterator]() {
			yield this.r, yield this.g, yield this.b;
		}
	};
	const U = new Zt();
	Zt.NAMES = oi;
	const Y = new x(), tt = new x(), ve = new x(), et = new x(), Mt = new x(), _t = new x(), ai = new x(), Te = new x(), Ce = new x(), ke = new x(), Ie = new we(), Be = new we(), Ve = new we();
	var Et = class Tt {
		constructor(t = new x(), e = new x(), s = new x()) {
			this.a = t, this.b = e, this.c = s;
		}
		static getNormal(t, e, s, r) {
			r.subVectors(s, e), Y.subVectors(t, e), r.cross(Y);
			const n = r.lengthSq();
			return n > 0 ? r.multiplyScalar(1 / Math.sqrt(n)) : r.set(0, 0, 0);
		}
		static getBarycoord(t, e, s, r, n) {
			Y.subVectors(r, e), tt.subVectors(s, e), ve.subVectors(t, e);
			const o = Y.dot(Y), a = Y.dot(tt), l = Y.dot(ve), h = tt.dot(tt), c = tt.dot(ve), u = o * h - a * a;
			if (u === 0) return n.set(0, 0, 0), null;
			const d = 1 / u, p = (h * l - a * c) * d, m = (o * c - a * l) * d;
			return n.set(1 - p - m, m, p);
		}
		static containsPoint(t, e, s, r) {
			return this.getBarycoord(t, e, s, r, et) === null ? !1 : et.x >= 0 && et.y >= 0 && et.x + et.y <= 1;
		}
		static getInterpolation(t, e, s, r, n, o, a, l) {
			return this.getBarycoord(t, e, s, r, et) === null ? (l.x = 0, l.y = 0, "z" in l && (l.z = 0), "w" in l && (l.w = 0), null) : (l.setScalar(0), l.addScaledVector(n, et.x), l.addScaledVector(o, et.y), l.addScaledVector(a, et.z), l);
		}
		static getInterpolatedAttribute(t, e, s, r, n, o) {
			return Ie.setScalar(0), Be.setScalar(0), Ve.setScalar(0), Ie.fromBufferAttribute(t, e), Be.fromBufferAttribute(t, s), Ve.fromBufferAttribute(t, r), o.setScalar(0), o.addScaledVector(Ie, n.x), o.addScaledVector(Be, n.y), o.addScaledVector(Ve, n.z), o;
		}
		static isFrontFacing(t, e, s, r) {
			return Y.subVectors(s, e), tt.subVectors(t, e), Y.cross(tt).dot(r) < 0;
		}
		set(t, e, s) {
			return this.a.copy(t), this.b.copy(e), this.c.copy(s), this;
		}
		setFromPointsAndIndices(t, e, s, r) {
			return this.a.copy(t[e]), this.b.copy(t[s]), this.c.copy(t[r]), this;
		}
		setFromAttributeAndIndices(t, e, s, r) {
			return this.a.fromBufferAttribute(t, e), this.b.fromBufferAttribute(t, s), this.c.fromBufferAttribute(t, r), this;
		}
		clone() {
			return new this.constructor().copy(this);
		}
		copy(t) {
			return this.a.copy(t.a), this.b.copy(t.b), this.c.copy(t.c), this;
		}
		getArea() {
			return Y.subVectors(this.c, this.b), tt.subVectors(this.a, this.b), Y.cross(tt).length() * .5;
		}
		getMidpoint(t) {
			return t.addVectors(this.a, this.b).add(this.c).multiplyScalar(1 / 3);
		}
		getNormal(t) {
			return Tt.getNormal(this.a, this.b, this.c, t);
		}
		getPlane(t) {
			return t.setFromCoplanarPoints(this.a, this.b, this.c);
		}
		getBarycoord(t, e) {
			return Tt.getBarycoord(t, this.a, this.b, this.c, e);
		}
		getInterpolation(t, e, s, r, n) {
			return Tt.getInterpolation(t, this.a, this.b, this.c, e, s, r, n);
		}
		containsPoint(t) {
			return Tt.containsPoint(t, this.a, this.b, this.c);
		}
		isFrontFacing(t) {
			return Tt.isFrontFacing(this.a, this.b, this.c, t);
		}
		intersectsBox(t) {
			return t.intersectsTriangle(this);
		}
		closestPointToPoint(t, e) {
			const s = this.a, r = this.b, n = this.c;
			let o, a;
			Mt.subVectors(r, s), _t.subVectors(n, s), Te.subVectors(t, s);
			const l = Mt.dot(Te), h = _t.dot(Te);
			if (l <= 0 && h <= 0) return e.copy(s);
			Ce.subVectors(t, r);
			const c = Mt.dot(Ce), u = _t.dot(Ce);
			if (c >= 0 && u <= c) return e.copy(r);
			const d = l * u - c * h;
			if (d <= 0 && l >= 0 && c <= 0) return o = l / (l - c), e.copy(s).addScaledVector(Mt, o);
			ke.subVectors(t, n);
			const p = Mt.dot(ke), m = _t.dot(ke);
			if (m >= 0 && p <= m) return e.copy(n);
			const f = p * h - l * m;
			if (f <= 0 && h >= 0 && m <= 0) return a = h / (h - m), e.copy(s).addScaledVector(_t, a);
			const y = c * m - p * u;
			if (y <= 0 && u - c >= 0 && p - m >= 0) return ai.subVectors(n, r), a = (u - c) / (u - c + (p - m)), e.copy(r).addScaledVector(ai, a);
			const g = 1 / (y + f + d);
			return o = f * g, a = d * g, e.copy(s).addScaledVector(Mt, o).addScaledVector(_t, a);
		}
		equals(t) {
			return t.a.equals(this.a) && t.b.equals(this.b) && t.c.equals(this.c);
		}
	}, Nt = class {
		constructor(i = new x(Infinity, Infinity, Infinity), t = new x(-Infinity, -Infinity, -Infinity)) {
			this.isBox3 = !0, this.min = i, this.max = t;
		}
		set(i, t) {
			return this.min.copy(i), this.max.copy(t), this;
		}
		setFromArray(i) {
			this.makeEmpty();
			for (let t = 0, e = i.length; t < e; t += 3) this.expandByPoint(H.fromArray(i, t));
			return this;
		}
		setFromBufferAttribute(i) {
			this.makeEmpty();
			for (let t = 0, e = i.count; t < e; t++) this.expandByPoint(H.fromBufferAttribute(i, t));
			return this;
		}
		setFromPoints(i) {
			this.makeEmpty();
			for (let t = 0, e = i.length; t < e; t++) this.expandByPoint(i[t]);
			return this;
		}
		setFromCenterAndSize(i, t) {
			const e = H.copy(t).multiplyScalar(.5);
			return this.min.copy(i).sub(e), this.max.copy(i).add(e), this;
		}
		setFromObject(i, t = !1) {
			return this.makeEmpty(), this.expandByObject(i, t);
		}
		clone() {
			return new this.constructor().copy(this);
		}
		copy(i) {
			return this.min.copy(i.min), this.max.copy(i.max), this;
		}
		makeEmpty() {
			return this.min.x = this.min.y = this.min.z = Infinity, this.max.x = this.max.y = this.max.z = -Infinity, this;
		}
		isEmpty() {
			return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z;
		}
		getCenter(i) {
			return this.isEmpty() ? i.set(0, 0, 0) : i.addVectors(this.min, this.max).multiplyScalar(.5);
		}
		getSize(i) {
			return this.isEmpty() ? i.set(0, 0, 0) : i.subVectors(this.max, this.min);
		}
		expandByPoint(i) {
			return this.min.min(i), this.max.max(i), this;
		}
		expandByVector(i) {
			return this.min.sub(i), this.max.add(i), this;
		}
		expandByScalar(i) {
			return this.min.addScalar(-i), this.max.addScalar(i), this;
		}
		expandByObject(i, t = !1) {
			i.updateWorldMatrix(!1, !1);
			const e = i.geometry;
			if (e !== void 0) {
				const r = e.getAttribute("position");
				if (t === !0 && r !== void 0 && i.isInstancedMesh !== !0) for (let n = 0, o = r.count; n < o; n++) i.isMesh === !0 ? i.getVertexPosition(n, H) : H.fromBufferAttribute(r, n), H.applyMatrix4(i.matrixWorld), this.expandByPoint(H);
				else i.boundingBox !== void 0 ? (i.boundingBox === null && i.computeBoundingBox(), Yt.copy(i.boundingBox)) : (e.boundingBox === null && e.computeBoundingBox(), Yt.copy(e.boundingBox)), Yt.applyMatrix4(i.matrixWorld), this.union(Yt);
			}
			const s = i.children;
			for (let r = 0, n = s.length; r < n; r++) this.expandByObject(s[r], t);
			return this;
		}
		containsPoint(i) {
			return i.x >= this.min.x && i.x <= this.max.x && i.y >= this.min.y && i.y <= this.max.y && i.z >= this.min.z && i.z <= this.max.z;
		}
		containsBox(i) {
			return this.min.x <= i.min.x && i.max.x <= this.max.x && this.min.y <= i.min.y && i.max.y <= this.max.y && this.min.z <= i.min.z && i.max.z <= this.max.z;
		}
		getParameter(i, t) {
			return t.set((i.x - this.min.x) / (this.max.x - this.min.x), (i.y - this.min.y) / (this.max.y - this.min.y), (i.z - this.min.z) / (this.max.z - this.min.z));
		}
		intersectsBox(i) {
			return i.max.x >= this.min.x && i.min.x <= this.max.x && i.max.y >= this.min.y && i.min.y <= this.max.y && i.max.z >= this.min.z && i.min.z <= this.max.z;
		}
		intersectsSphere(i) {
			return this.clampPoint(i.center, H), H.distanceToSquared(i.center) <= i.radius * i.radius;
		}
		intersectsPlane(i) {
			let t, e;
			return i.normal.x > 0 ? (t = i.normal.x * this.min.x, e = i.normal.x * this.max.x) : (t = i.normal.x * this.max.x, e = i.normal.x * this.min.x), i.normal.y > 0 ? (t += i.normal.y * this.min.y, e += i.normal.y * this.max.y) : (t += i.normal.y * this.max.y, e += i.normal.y * this.min.y), i.normal.z > 0 ? (t += i.normal.z * this.min.z, e += i.normal.z * this.max.z) : (t += i.normal.z * this.max.z, e += i.normal.z * this.min.z), t <= -i.constant && e >= -i.constant;
		}
		intersectsTriangle(i) {
			if (this.isEmpty()) return !1;
			this.getCenter(Ot), Ht.subVectors(this.max, Ot), wt.subVectors(i.a, Ot), zt.subVectors(i.b, Ot), St.subVectors(i.c, Ot), at.subVectors(zt, wt), ht.subVectors(St, zt), ct.subVectors(wt, St);
			let t = [
				0,
				-at.z,
				at.y,
				0,
				-ht.z,
				ht.y,
				0,
				-ct.z,
				ct.y,
				at.z,
				0,
				-at.x,
				ht.z,
				0,
				-ht.x,
				ct.z,
				0,
				-ct.x,
				-at.y,
				at.x,
				0,
				-ht.y,
				ht.x,
				0,
				-ct.y,
				ct.x,
				0
			];
			return !Ee(t, wt, zt, St, Ht) || (t = [
				1,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				1
			], !Ee(t, wt, zt, St, Ht)) ? !1 : (Jt.crossVectors(at, ht), t = [
				Jt.x,
				Jt.y,
				Jt.z
			], Ee(t, wt, zt, St, Ht));
		}
		clampPoint(i, t) {
			return t.copy(i).clamp(this.min, this.max);
		}
		distanceToPoint(i) {
			return this.clampPoint(i, H).distanceTo(i);
		}
		getBoundingSphere(i) {
			return this.isEmpty() ? i.makeEmpty() : (this.getCenter(i.center), i.radius = this.getSize(H).length() * .5), i;
		}
		intersect(i) {
			return this.min.max(i.min), this.max.min(i.max), this.isEmpty() && this.makeEmpty(), this;
		}
		union(i) {
			return this.min.min(i.min), this.max.max(i.max), this;
		}
		applyMatrix4(i) {
			return this.isEmpty() ? this : (it[0].set(this.min.x, this.min.y, this.min.z).applyMatrix4(i), it[1].set(this.min.x, this.min.y, this.max.z).applyMatrix4(i), it[2].set(this.min.x, this.max.y, this.min.z).applyMatrix4(i), it[3].set(this.min.x, this.max.y, this.max.z).applyMatrix4(i), it[4].set(this.max.x, this.min.y, this.min.z).applyMatrix4(i), it[5].set(this.max.x, this.min.y, this.max.z).applyMatrix4(i), it[6].set(this.max.x, this.max.y, this.min.z).applyMatrix4(i), it[7].set(this.max.x, this.max.y, this.max.z).applyMatrix4(i), this.setFromPoints(it), this);
		}
		translate(i) {
			return this.min.add(i), this.max.add(i), this;
		}
		equals(i) {
			return i.min.equals(this.min) && i.max.equals(this.max);
		}
		toJSON() {
			return {
				min: this.min.toArray(),
				max: this.max.toArray()
			};
		}
		fromJSON(i) {
			return this.min.fromArray(i.min), this.max.fromArray(i.max), this;
		}
	};
	const it = [
		new x(),
		new x(),
		new x(),
		new x(),
		new x(),
		new x(),
		new x(),
		new x()
	], H = new x(), Yt = new Nt(), wt = new x(), zt = new x(), St = new x(), at = new x(), ht = new x(), ct = new x(), Ot = new x(), Ht = new x(), Jt = new x(), ut = new x();
	function Ee(i, t, e, s, r) {
		for (let n = 0, o = i.length - 3; n <= o; n += 3) {
			ut.fromArray(i, n);
			const a = r.x * Math.abs(ut.x) + r.y * Math.abs(ut.y) + r.z * Math.abs(ut.z), l = t.dot(ut), h = e.dot(ut), c = s.dot(ut);
			if (Math.max(-Math.max(l, h, c), Math.min(l, h, c)) > a) return !1;
		}
		return !0;
	}
	const R = new x(), Gt = new $();
	let Pi = 0;
	var At = class {
		constructor(i, t, e = !1) {
			if (Array.isArray(i)) throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");
			this.isBufferAttribute = !0, Object.defineProperty(this, "id", { value: Pi++ }), this.name = "", this.array = i, this.itemSize = t, this.count = i !== void 0 ? i.length / t : 0, this.normalized = e, this.usage = 35044, this.updateRanges = [], this.gpuType = 1015, this.version = 0;
		}
		onUploadCallback() {}
		set needsUpdate(i) {
			i === !0 && this.version++;
		}
		setUsage(i) {
			return this.usage = i, this;
		}
		addUpdateRange(i, t) {
			this.updateRanges.push({
				start: i,
				count: t
			});
		}
		clearUpdateRanges() {
			this.updateRanges.length = 0;
		}
		copy(i) {
			return this.name = i.name, this.array = new i.array.constructor(i.array), this.itemSize = i.itemSize, this.count = i.count, this.normalized = i.normalized, this.usage = i.usage, this.gpuType = i.gpuType, this;
		}
		copyAt(i, t, e) {
			i *= this.itemSize, e *= t.itemSize;
			for (let s = 0, r = this.itemSize; s < r; s++) this.array[i + s] = t.array[e + s];
			return this;
		}
		copyArray(i) {
			return this.array.set(i), this;
		}
		applyMatrix3(i) {
			if (this.itemSize === 2) for (let t = 0, e = this.count; t < e; t++) Gt.fromBufferAttribute(this, t), Gt.applyMatrix3(i), this.setXY(t, Gt.x, Gt.y);
			else if (this.itemSize === 3) for (let t = 0, e = this.count; t < e; t++) R.fromBufferAttribute(this, t), R.applyMatrix3(i), this.setXYZ(t, R.x, R.y, R.z);
			return this;
		}
		applyMatrix4(i) {
			for (let t = 0, e = this.count; t < e; t++) R.fromBufferAttribute(this, t), R.applyMatrix4(i), this.setXYZ(t, R.x, R.y, R.z);
			return this;
		}
		applyNormalMatrix(i) {
			for (let t = 0, e = this.count; t < e; t++) R.fromBufferAttribute(this, t), R.applyNormalMatrix(i), this.setXYZ(t, R.x, R.y, R.z);
			return this;
		}
		transformDirection(i) {
			for (let t = 0, e = this.count; t < e; t++) R.fromBufferAttribute(this, t), R.transformDirection(i), this.setXYZ(t, R.x, R.y, R.z);
			return this;
		}
		set(i, t = 0) {
			return this.array.set(i, t), this;
		}
		getComponent(i, t) {
			let e = this.array[i * this.itemSize + t];
			return this.normalized && (e = It(e, this.array)), e;
		}
		setComponent(i, t, e) {
			return this.normalized && (e = W(e, this.array)), this.array[i * this.itemSize + t] = e, this;
		}
		getX(i) {
			let t = this.array[i * this.itemSize];
			return this.normalized && (t = It(t, this.array)), t;
		}
		setX(i, t) {
			return this.normalized && (t = W(t, this.array)), this.array[i * this.itemSize] = t, this;
		}
		getY(i) {
			let t = this.array[i * this.itemSize + 1];
			return this.normalized && (t = It(t, this.array)), t;
		}
		setY(i, t) {
			return this.normalized && (t = W(t, this.array)), this.array[i * this.itemSize + 1] = t, this;
		}
		getZ(i) {
			let t = this.array[i * this.itemSize + 2];
			return this.normalized && (t = It(t, this.array)), t;
		}
		setZ(i, t) {
			return this.normalized && (t = W(t, this.array)), this.array[i * this.itemSize + 2] = t, this;
		}
		getW(i) {
			let t = this.array[i * this.itemSize + 3];
			return this.normalized && (t = It(t, this.array)), t;
		}
		setW(i, t) {
			return this.normalized && (t = W(t, this.array)), this.array[i * this.itemSize + 3] = t, this;
		}
		setXY(i, t, e) {
			return i *= this.itemSize, this.normalized && (t = W(t, this.array), e = W(e, this.array)), this.array[i + 0] = t, this.array[i + 1] = e, this;
		}
		setXYZ(i, t, e, s) {
			return i *= this.itemSize, this.normalized && (t = W(t, this.array), e = W(e, this.array), s = W(s, this.array)), this.array[i + 0] = t, this.array[i + 1] = e, this.array[i + 2] = s, this;
		}
		setXYZW(i, t, e, s, r) {
			return i *= this.itemSize, this.normalized && (t = W(t, this.array), e = W(e, this.array), s = W(s, this.array), r = W(r, this.array)), this.array[i + 0] = t, this.array[i + 1] = e, this.array[i + 2] = s, this.array[i + 3] = r, this;
		}
		onUpload(i) {
			return this.onUploadCallback = i, this;
		}
		clone() {
			return new this.constructor(this.array, this.itemSize).copy(this);
		}
		toJSON() {
			const i = {
				itemSize: this.itemSize,
				type: this.array.constructor.name,
				array: Array.from(this.array),
				normalized: this.normalized
			};
			return this.name !== "" && (i.name = this.name), this.usage !== 35044 && (i.usage = this.usage), i;
		}
	}, Di = class extends At {
		constructor(i, t, e) {
			super(new Uint16Array(i), t, e);
		}
	}, Ui = class extends At {
		constructor(i, t, e) {
			super(new Uint32Array(i), t, e);
		}
	}, $t = class extends At {
		constructor(i, t, e) {
			super(new Float32Array(i), t, e);
		}
	};
	const Wi = new Nt(), Rt = new x(), Ne = new x();
	var hi = class {
		constructor(i = new x(), t = -1) {
			this.isSphere = !0, this.center = i, this.radius = t;
		}
		set(i, t) {
			return this.center.copy(i), this.radius = t, this;
		}
		setFromPoints(i, t) {
			const e = this.center;
			t !== void 0 ? e.copy(t) : Wi.setFromPoints(i).getCenter(e);
			let s = 0;
			for (let r = 0, n = i.length; r < n; r++) s = Math.max(s, e.distanceToSquared(i[r]));
			return this.radius = Math.sqrt(s), this;
		}
		copy(i) {
			return this.center.copy(i.center), this.radius = i.radius, this;
		}
		isEmpty() {
			return this.radius < 0;
		}
		makeEmpty() {
			return this.center.set(0, 0, 0), this.radius = -1, this;
		}
		containsPoint(i) {
			return i.distanceToSquared(this.center) <= this.radius * this.radius;
		}
		distanceToPoint(i) {
			return i.distanceTo(this.center) - this.radius;
		}
		intersectsSphere(i) {
			const t = this.radius + i.radius;
			return i.center.distanceToSquared(this.center) <= t * t;
		}
		intersectsBox(i) {
			return i.intersectsSphere(this);
		}
		intersectsPlane(i) {
			return Math.abs(i.distanceToPoint(this.center)) <= this.radius;
		}
		clampPoint(i, t) {
			const e = this.center.distanceToSquared(i);
			return t.copy(i), e > this.radius * this.radius && (t.sub(this.center).normalize(), t.multiplyScalar(this.radius).add(this.center)), t;
		}
		getBoundingBox(i) {
			return this.isEmpty() ? (i.makeEmpty(), i) : (i.set(this.center, this.center), i.expandByScalar(this.radius), i);
		}
		applyMatrix4(i) {
			return this.center.applyMatrix4(i), this.radius = this.radius * i.getMaxScaleOnAxis(), this;
		}
		translate(i) {
			return this.center.add(i), this;
		}
		expandByPoint(i) {
			if (this.isEmpty()) return this.center.copy(i), this.radius = 0, this;
			Rt.subVectors(i, this.center);
			const t = Rt.lengthSq();
			if (t > this.radius * this.radius) {
				const e = Math.sqrt(t), s = (e - this.radius) * .5;
				this.center.addScaledVector(Rt, s / e), this.radius += s;
			}
			return this;
		}
		union(i) {
			return i.isEmpty() ? this : this.isEmpty() ? (this.copy(i), this) : (this.center.equals(i.center) === !0 ? this.radius = Math.max(this.radius, i.radius) : (Ne.subVectors(i.center, this.center).setLength(i.radius), this.expandByPoint(Rt.copy(i.center).add(Ne)), this.expandByPoint(Rt.copy(i.center).sub(Ne))), this);
		}
		equals(i) {
			return i.center.equals(this.center) && i.radius === this.radius;
		}
		clone() {
			return new this.constructor().copy(this);
		}
		toJSON() {
			return {
				radius: this.radius,
				center: this.center.toArray()
			};
		}
		fromJSON(i) {
			return this.radius = i.radius, this.center.fromArray(i.center), this;
		}
	};
	let Li = 0;
	const j = new rt(), Oe = new Vt(), vt = new x(), q = new Nt(), Ft = new Nt(), P = new x();
	var li = class _i extends Lt {
		constructor() {
			super(), this.isBufferGeometry = !0, Object.defineProperty(this, "id", { value: Li++ }), this.uuid = kt(), this.name = "", this.type = "BufferGeometry", this.index = null, this.indirect = null, this.indirectOffset = 0, this.attributes = {}, this.morphAttributes = {}, this.morphTargetsRelative = !1, this.groups = [], this.boundingBox = null, this.boundingSphere = null, this.drawRange = {
				start: 0,
				count: Infinity
			}, this.userData = {};
		}
		getIndex() {
			return this.index;
		}
		setIndex(t) {
			return Array.isArray(t) ? this.index = new (zi(t) ? Ui : Di)(t, 1) : this.index = t, this;
		}
		setIndirect(t, e = 0) {
			return this.indirect = t, this.indirectOffset = e, this;
		}
		getIndirect() {
			return this.indirect;
		}
		getAttribute(t) {
			return this.attributes[t];
		}
		setAttribute(t, e) {
			return this.attributes[t] = e, this;
		}
		deleteAttribute(t) {
			return delete this.attributes[t], this;
		}
		hasAttribute(t) {
			return this.attributes[t] !== void 0;
		}
		addGroup(t, e, s = 0) {
			this.groups.push({
				start: t,
				count: e,
				materialIndex: s
			});
		}
		clearGroups() {
			this.groups = [];
		}
		setDrawRange(t, e) {
			this.drawRange.start = t, this.drawRange.count = e;
		}
		applyMatrix4(t) {
			const e = this.attributes.position;
			e !== void 0 && (e.applyMatrix4(t), e.needsUpdate = !0);
			const s = this.attributes.normal;
			if (s !== void 0) {
				const n = new mt().getNormalMatrix(t);
				s.applyNormalMatrix(n), s.needsUpdate = !0;
			}
			const r = this.attributes.tangent;
			return r !== void 0 && (r.transformDirection(t), r.needsUpdate = !0), this.boundingBox !== null && this.computeBoundingBox(), this.boundingSphere !== null && this.computeBoundingSphere(), this;
		}
		applyQuaternion(t) {
			return j.makeRotationFromQuaternion(t), this.applyMatrix4(j), this;
		}
		rotateX(t) {
			return j.makeRotationX(t), this.applyMatrix4(j), this;
		}
		rotateY(t) {
			return j.makeRotationY(t), this.applyMatrix4(j), this;
		}
		rotateZ(t) {
			return j.makeRotationZ(t), this.applyMatrix4(j), this;
		}
		translate(t, e, s) {
			return j.makeTranslation(t, e, s), this.applyMatrix4(j), this;
		}
		scale(t, e, s) {
			return j.makeScale(t, e, s), this.applyMatrix4(j), this;
		}
		lookAt(t) {
			return Oe.lookAt(t), Oe.updateMatrix(), this.applyMatrix4(Oe.matrix), this;
		}
		center() {
			return this.computeBoundingBox(), this.boundingBox.getCenter(vt).negate(), this.translate(vt.x, vt.y, vt.z), this;
		}
		setFromPoints(t) {
			const e = this.getAttribute("position");
			if (e === void 0) {
				const s = [];
				for (let r = 0, n = t.length; r < n; r++) {
					const o = t[r];
					s.push(o.x, o.y, o.z || 0);
				}
				this.setAttribute("position", new $t(s, 3));
			} else {
				const s = Math.min(t.length, e.count);
				for (let r = 0; r < s; r++) {
					const n = t[r];
					e.setXYZ(r, n.x, n.y, n.z || 0);
				}
				t.length > e.count && F("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."), e.needsUpdate = !0;
			}
			return this;
		}
		computeBoundingBox() {
			this.boundingBox === null && (this.boundingBox = new Nt());
			const t = this.attributes.position, e = this.morphAttributes.position;
			if (t && t.isGLBufferAttribute) {
				E("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.", this), this.boundingBox.set(new x(-Infinity, -Infinity, -Infinity), new x(Infinity, Infinity, Infinity));
				return;
			}
			if (t !== void 0) {
				if (this.boundingBox.setFromBufferAttribute(t), e) for (let s = 0, r = e.length; s < r; s++) {
					const n = e[s];
					q.setFromBufferAttribute(n), this.morphTargetsRelative ? (P.addVectors(this.boundingBox.min, q.min), this.boundingBox.expandByPoint(P), P.addVectors(this.boundingBox.max, q.max), this.boundingBox.expandByPoint(P)) : (this.boundingBox.expandByPoint(q.min), this.boundingBox.expandByPoint(q.max));
				}
			} else this.boundingBox.makeEmpty();
			(isNaN(this.boundingBox.min.x) || isNaN(this.boundingBox.min.y) || isNaN(this.boundingBox.min.z)) && E("BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The \"position\" attribute is likely to have NaN values.", this);
		}
		computeBoundingSphere() {
			this.boundingSphere === null && (this.boundingSphere = new hi());
			const t = this.attributes.position, e = this.morphAttributes.position;
			if (t && t.isGLBufferAttribute) {
				E("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.", this), this.boundingSphere.set(new x(), Infinity);
				return;
			}
			if (t) {
				const s = this.boundingSphere.center;
				if (q.setFromBufferAttribute(t), e) for (let n = 0, o = e.length; n < o; n++) {
					const a = e[n];
					Ft.setFromBufferAttribute(a), this.morphTargetsRelative ? (P.addVectors(q.min, Ft.min), q.expandByPoint(P), P.addVectors(q.max, Ft.max), q.expandByPoint(P)) : (q.expandByPoint(Ft.min), q.expandByPoint(Ft.max));
				}
				q.getCenter(s);
				let r = 0;
				for (let n = 0, o = t.count; n < o; n++) P.fromBufferAttribute(t, n), r = Math.max(r, s.distanceToSquared(P));
				if (e) for (let n = 0, o = e.length; n < o; n++) {
					const a = e[n], l = this.morphTargetsRelative;
					for (let h = 0, c = a.count; h < c; h++) P.fromBufferAttribute(a, h), l && (vt.fromBufferAttribute(t, h), P.add(vt)), r = Math.max(r, s.distanceToSquared(P));
				}
				this.boundingSphere.radius = Math.sqrt(r), isNaN(this.boundingSphere.radius) && E("BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The \"position\" attribute is likely to have NaN values.", this);
			}
		}
		computeTangents() {
			const t = this.index, e = this.attributes;
			if (t === null || e.position === void 0 || e.normal === void 0 || e.uv === void 0) {
				E("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");
				return;
			}
			const s = e.position, r = e.normal, n = e.uv;
			this.hasAttribute("tangent") === !1 && this.setAttribute("tangent", new At(new Float32Array(4 * s.count), 4));
			const o = this.getAttribute("tangent"), a = [], l = [];
			for (let A = 0; A < s.count; A++) a[A] = new x(), l[A] = new x();
			const h = new x(), c = new x(), u = new x(), d = new $(), p = new $(), m = new $(), f = new x(), y = new x();
			function g(A, T, v) {
				h.fromBufferAttribute(s, A), c.fromBufferAttribute(s, T), u.fromBufferAttribute(s, v), d.fromBufferAttribute(n, A), p.fromBufferAttribute(n, T), m.fromBufferAttribute(n, v), c.sub(h), u.sub(h), p.sub(d), m.sub(d);
				const k = 1 / (p.x * m.y - m.x * p.y);
				isFinite(k) && (f.copy(c).multiplyScalar(m.y).addScaledVector(u, -p.y).multiplyScalar(k), y.copy(u).multiplyScalar(p.x).addScaledVector(c, -m.x).multiplyScalar(k), a[A].add(f), a[T].add(f), a[v].add(f), l[A].add(y), l[T].add(y), l[v].add(y));
			}
			let b = this.groups;
			b.length === 0 && (b = [{
				start: 0,
				count: t.count
			}]);
			for (let A = 0, T = b.length; A < T; ++A) {
				const v = b[A], k = v.start, B = v.count;
				for (let I = k, O = k + B; I < O; I += 3) g(t.getX(I + 0), t.getX(I + 1), t.getX(I + 2));
			}
			const _ = new x(), M = new x(), w = new x(), z = new x();
			function S(A) {
				w.fromBufferAttribute(r, A), z.copy(w);
				const T = a[A];
				_.copy(T), _.sub(w.multiplyScalar(w.dot(T))).normalize(), M.crossVectors(z, T);
				const v = M.dot(l[A]) < 0 ? -1 : 1;
				o.setXYZW(A, _.x, _.y, _.z, v);
			}
			for (let A = 0, T = b.length; A < T; ++A) {
				const v = b[A], k = v.start, B = v.count;
				for (let I = k, O = k + B; I < O; I += 3) S(t.getX(I + 0)), S(t.getX(I + 1)), S(t.getX(I + 2));
			}
		}
		computeVertexNormals() {
			const t = this.index, e = this.getAttribute("position");
			if (e !== void 0) {
				let s = this.getAttribute("normal");
				if (s === void 0) s = new At(new Float32Array(e.count * 3), 3), this.setAttribute("normal", s);
				else for (let d = 0, p = s.count; d < p; d++) s.setXYZ(d, 0, 0, 0);
				const r = new x(), n = new x(), o = new x(), a = new x(), l = new x(), h = new x(), c = new x(), u = new x();
				if (t) for (let d = 0, p = t.count; d < p; d += 3) {
					const m = t.getX(d + 0), f = t.getX(d + 1), y = t.getX(d + 2);
					r.fromBufferAttribute(e, m), n.fromBufferAttribute(e, f), o.fromBufferAttribute(e, y), c.subVectors(o, n), u.subVectors(r, n), c.cross(u), a.fromBufferAttribute(s, m), l.fromBufferAttribute(s, f), h.fromBufferAttribute(s, y), a.add(c), l.add(c), h.add(c), s.setXYZ(m, a.x, a.y, a.z), s.setXYZ(f, l.x, l.y, l.z), s.setXYZ(y, h.x, h.y, h.z);
				}
				else for (let d = 0, p = e.count; d < p; d += 3) r.fromBufferAttribute(e, d + 0), n.fromBufferAttribute(e, d + 1), o.fromBufferAttribute(e, d + 2), c.subVectors(o, n), u.subVectors(r, n), c.cross(u), s.setXYZ(d + 0, c.x, c.y, c.z), s.setXYZ(d + 1, c.x, c.y, c.z), s.setXYZ(d + 2, c.x, c.y, c.z);
				this.normalizeNormals(), s.needsUpdate = !0;
			}
		}
		normalizeNormals() {
			const t = this.attributes.normal;
			for (let e = 0, s = t.count; e < s; e++) P.fromBufferAttribute(t, e), P.normalize(), t.setXYZ(e, P.x, P.y, P.z);
		}
		toNonIndexed() {
			function t(a, l) {
				const h = a.array, c = a.itemSize, u = a.normalized, d = new h.constructor(l.length * c);
				let p = 0, m = 0;
				for (let f = 0, y = l.length; f < y; f++) {
					a.isInterleavedBufferAttribute ? p = l[f] * a.data.stride + a.offset : p = l[f] * c;
					for (let g = 0; g < c; g++) d[m++] = h[p++];
				}
				return new At(d, c, u);
			}
			if (this.index === null) return F("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."), this;
			const e = new _i(), s = this.index.array, r = this.attributes;
			for (const a in r) {
				const l = r[a], h = t(l, s);
				e.setAttribute(a, h);
			}
			const n = this.morphAttributes;
			for (const a in n) {
				const l = [], h = n[a];
				for (let c = 0, u = h.length; c < u; c++) {
					const d = h[c], p = t(d, s);
					l.push(p);
				}
				e.morphAttributes[a] = l;
			}
			e.morphTargetsRelative = this.morphTargetsRelative;
			const o = this.groups;
			for (let a = 0, l = o.length; a < l; a++) {
				const h = o[a];
				e.addGroup(h.start, h.count, h.materialIndex);
			}
			return e;
		}
		toJSON() {
			const t = { metadata: {
				version: 4.7,
				type: "BufferGeometry",
				generator: "BufferGeometry.toJSON"
			} };
			if (t.uuid = this.uuid, t.type = this.type, this.name !== "" && (t.name = this.name), Object.keys(this.userData).length > 0 && (t.userData = this.userData), this.parameters !== void 0) {
				const l = this.parameters;
				for (const h in l) l[h] !== void 0 && (t[h] = l[h]);
				return t;
			}
			t.data = { attributes: {} };
			const e = this.index;
			e !== null && (t.data.index = {
				type: e.array.constructor.name,
				array: Array.prototype.slice.call(e.array)
			});
			const s = this.attributes;
			for (const l in s) {
				const h = s[l];
				t.data.attributes[l] = h.toJSON(t.data);
			}
			const r = {};
			let n = !1;
			for (const l in this.morphAttributes) {
				const h = this.morphAttributes[l], c = [];
				for (let u = 0, d = h.length; u < d; u++) {
					const p = h[u];
					c.push(p.toJSON(t.data));
				}
				c.length > 0 && (r[l] = c, n = !0);
			}
			n && (t.data.morphAttributes = r, t.data.morphTargetsRelative = this.morphTargetsRelative);
			const o = this.groups;
			o.length > 0 && (t.data.groups = JSON.parse(JSON.stringify(o)));
			const a = this.boundingSphere;
			return a !== null && (t.data.boundingSphere = a.toJSON()), t;
		}
		clone() {
			return new this.constructor().copy(this);
		}
		copy(t) {
			this.index = null, this.attributes = {}, this.morphAttributes = {}, this.groups = [], this.boundingBox = null, this.boundingSphere = null;
			const e = {};
			this.name = t.name;
			const s = t.index;
			s !== null && this.setIndex(s.clone());
			const r = t.attributes;
			for (const h in r) {
				const c = r[h];
				this.setAttribute(h, c.clone(e));
			}
			const n = t.morphAttributes;
			for (const h in n) {
				const c = [], u = n[h];
				for (let d = 0, p = u.length; d < p; d++) c.push(u[d].clone(e));
				this.morphAttributes[h] = c;
			}
			this.morphTargetsRelative = t.morphTargetsRelative;
			const o = t.groups;
			for (let h = 0, c = o.length; h < c; h++) {
				const u = o[h];
				this.addGroup(u.start, u.count, u.materialIndex);
			}
			const a = t.boundingBox;
			a !== null && (this.boundingBox = a.clone());
			const l = t.boundingSphere;
			return l !== null && (this.boundingSphere = l.clone()), this.drawRange.start = t.drawRange.start, this.drawRange.count = t.drawRange.count, this.userData = t.userData, this;
		}
		dispose() {
			this.dispatchEvent({ type: "dispose" });
		}
	};
	let qi = 0;
	var ji = class extends Lt {
		constructor() {
			super(), this.isMaterial = !0, Object.defineProperty(this, "id", { value: qi++ }), this.uuid = kt(), this.name = "", this.type = "Material", this.blending = 1, this.side = 0, this.vertexColors = !1, this.opacity = 1, this.transparent = !1, this.alphaHash = !1, this.blendSrc = 204, this.blendDst = 205, this.blendEquation = 100, this.blendSrcAlpha = null, this.blendDstAlpha = null, this.blendEquationAlpha = null, this.blendColor = new Zt(0, 0, 0), this.blendAlpha = 0, this.depthFunc = 3, this.depthTest = !0, this.depthWrite = !0, this.stencilWriteMask = 255, this.stencilFunc = 519, this.stencilRef = 0, this.stencilFuncMask = 255, this.stencilFail = 7680, this.stencilZFail = 7680, this.stencilZPass = 7680, this.stencilWrite = !1, this.clippingPlanes = null, this.clipIntersection = !1, this.clipShadows = !1, this.shadowSide = null, this.colorWrite = !0, this.precision = null, this.polygonOffset = !1, this.polygonOffsetFactor = 0, this.polygonOffsetUnits = 0, this.dithering = !1, this.alphaToCoverage = !1, this.premultipliedAlpha = !1, this.forceSinglePass = !1, this.allowOverride = !0, this.visible = !0, this.toneMapped = !0, this.userData = {}, this.version = 0, this._alphaTest = 0;
		}
		get alphaTest() {
			return this._alphaTest;
		}
		set alphaTest(i) {
			this._alphaTest > 0 != i > 0 && this.version++, this._alphaTest = i;
		}
		onBeforeRender() {}
		onBeforeCompile() {}
		customProgramCacheKey() {
			return this.onBeforeCompile.toString();
		}
		setValues(i) {
			if (i !== void 0) for (const t in i) {
				const e = i[t];
				if (e === void 0) {
					F(`Material: parameter '${t}' has value of undefined.`);
					continue;
				}
				const s = this[t];
				if (s === void 0) {
					F(`Material: '${t}' is not a property of THREE.${this.type}.`);
					continue;
				}
				s && s.isColor ? s.set(e) : s && s.isVector3 && e && e.isVector3 ? s.copy(e) : this[t] = e;
			}
		}
		toJSON(i) {
			const t = i === void 0 || typeof i == "string";
			t && (i = {
				textures: {},
				images: {}
			});
			const e = { metadata: {
				version: 4.7,
				type: "Material",
				generator: "Material.toJSON"
			} };
			e.uuid = this.uuid, e.type = this.type, this.name !== "" && (e.name = this.name), this.color && this.color.isColor && (e.color = this.color.getHex()), this.roughness !== void 0 && (e.roughness = this.roughness), this.metalness !== void 0 && (e.metalness = this.metalness), this.sheen !== void 0 && (e.sheen = this.sheen), this.sheenColor && this.sheenColor.isColor && (e.sheenColor = this.sheenColor.getHex()), this.sheenRoughness !== void 0 && (e.sheenRoughness = this.sheenRoughness), this.emissive && this.emissive.isColor && (e.emissive = this.emissive.getHex()), this.emissiveIntensity !== void 0 && this.emissiveIntensity !== 1 && (e.emissiveIntensity = this.emissiveIntensity), this.specular && this.specular.isColor && (e.specular = this.specular.getHex()), this.specularIntensity !== void 0 && (e.specularIntensity = this.specularIntensity), this.specularColor && this.specularColor.isColor && (e.specularColor = this.specularColor.getHex()), this.shininess !== void 0 && (e.shininess = this.shininess), this.clearcoat !== void 0 && (e.clearcoat = this.clearcoat), this.clearcoatRoughness !== void 0 && (e.clearcoatRoughness = this.clearcoatRoughness), this.clearcoatMap && this.clearcoatMap.isTexture && (e.clearcoatMap = this.clearcoatMap.toJSON(i).uuid), this.clearcoatRoughnessMap && this.clearcoatRoughnessMap.isTexture && (e.clearcoatRoughnessMap = this.clearcoatRoughnessMap.toJSON(i).uuid), this.clearcoatNormalMap && this.clearcoatNormalMap.isTexture && (e.clearcoatNormalMap = this.clearcoatNormalMap.toJSON(i).uuid, e.clearcoatNormalScale = this.clearcoatNormalScale.toArray()), this.sheenColorMap && this.sheenColorMap.isTexture && (e.sheenColorMap = this.sheenColorMap.toJSON(i).uuid), this.sheenRoughnessMap && this.sheenRoughnessMap.isTexture && (e.sheenRoughnessMap = this.sheenRoughnessMap.toJSON(i).uuid), this.dispersion !== void 0 && (e.dispersion = this.dispersion), this.iridescence !== void 0 && (e.iridescence = this.iridescence), this.iridescenceIOR !== void 0 && (e.iridescenceIOR = this.iridescenceIOR), this.iridescenceThicknessRange !== void 0 && (e.iridescenceThicknessRange = this.iridescenceThicknessRange), this.iridescenceMap && this.iridescenceMap.isTexture && (e.iridescenceMap = this.iridescenceMap.toJSON(i).uuid), this.iridescenceThicknessMap && this.iridescenceThicknessMap.isTexture && (e.iridescenceThicknessMap = this.iridescenceThicknessMap.toJSON(i).uuid), this.anisotropy !== void 0 && (e.anisotropy = this.anisotropy), this.anisotropyRotation !== void 0 && (e.anisotropyRotation = this.anisotropyRotation), this.anisotropyMap && this.anisotropyMap.isTexture && (e.anisotropyMap = this.anisotropyMap.toJSON(i).uuid), this.map && this.map.isTexture && (e.map = this.map.toJSON(i).uuid), this.matcap && this.matcap.isTexture && (e.matcap = this.matcap.toJSON(i).uuid), this.alphaMap && this.alphaMap.isTexture && (e.alphaMap = this.alphaMap.toJSON(i).uuid), this.lightMap && this.lightMap.isTexture && (e.lightMap = this.lightMap.toJSON(i).uuid, e.lightMapIntensity = this.lightMapIntensity), this.aoMap && this.aoMap.isTexture && (e.aoMap = this.aoMap.toJSON(i).uuid, e.aoMapIntensity = this.aoMapIntensity), this.bumpMap && this.bumpMap.isTexture && (e.bumpMap = this.bumpMap.toJSON(i).uuid, e.bumpScale = this.bumpScale), this.normalMap && this.normalMap.isTexture && (e.normalMap = this.normalMap.toJSON(i).uuid, e.normalMapType = this.normalMapType, e.normalScale = this.normalScale.toArray()), this.displacementMap && this.displacementMap.isTexture && (e.displacementMap = this.displacementMap.toJSON(i).uuid, e.displacementScale = this.displacementScale, e.displacementBias = this.displacementBias), this.roughnessMap && this.roughnessMap.isTexture && (e.roughnessMap = this.roughnessMap.toJSON(i).uuid), this.metalnessMap && this.metalnessMap.isTexture && (e.metalnessMap = this.metalnessMap.toJSON(i).uuid), this.emissiveMap && this.emissiveMap.isTexture && (e.emissiveMap = this.emissiveMap.toJSON(i).uuid), this.specularMap && this.specularMap.isTexture && (e.specularMap = this.specularMap.toJSON(i).uuid), this.specularIntensityMap && this.specularIntensityMap.isTexture && (e.specularIntensityMap = this.specularIntensityMap.toJSON(i).uuid), this.specularColorMap && this.specularColorMap.isTexture && (e.specularColorMap = this.specularColorMap.toJSON(i).uuid), this.envMap && this.envMap.isTexture && (e.envMap = this.envMap.toJSON(i).uuid, this.combine !== void 0 && (e.combine = this.combine)), this.envMapRotation !== void 0 && (e.envMapRotation = this.envMapRotation.toArray()), this.envMapIntensity !== void 0 && (e.envMapIntensity = this.envMapIntensity), this.reflectivity !== void 0 && (e.reflectivity = this.reflectivity), this.refractionRatio !== void 0 && (e.refractionRatio = this.refractionRatio), this.gradientMap && this.gradientMap.isTexture && (e.gradientMap = this.gradientMap.toJSON(i).uuid), this.transmission !== void 0 && (e.transmission = this.transmission), this.transmissionMap && this.transmissionMap.isTexture && (e.transmissionMap = this.transmissionMap.toJSON(i).uuid), this.thickness !== void 0 && (e.thickness = this.thickness), this.thicknessMap && this.thicknessMap.isTexture && (e.thicknessMap = this.thicknessMap.toJSON(i).uuid), this.attenuationDistance !== void 0 && this.attenuationDistance !== Infinity && (e.attenuationDistance = this.attenuationDistance), this.attenuationColor !== void 0 && (e.attenuationColor = this.attenuationColor.getHex()), this.size !== void 0 && (e.size = this.size), this.shadowSide !== null && (e.shadowSide = this.shadowSide), this.sizeAttenuation !== void 0 && (e.sizeAttenuation = this.sizeAttenuation), this.blending !== 1 && (e.blending = this.blending), this.side !== 0 && (e.side = this.side), this.vertexColors === !0 && (e.vertexColors = !0), this.opacity < 1 && (e.opacity = this.opacity), this.transparent === !0 && (e.transparent = !0), this.blendSrc !== 204 && (e.blendSrc = this.blendSrc), this.blendDst !== 205 && (e.blendDst = this.blendDst), this.blendEquation !== 100 && (e.blendEquation = this.blendEquation), this.blendSrcAlpha !== null && (e.blendSrcAlpha = this.blendSrcAlpha), this.blendDstAlpha !== null && (e.blendDstAlpha = this.blendDstAlpha), this.blendEquationAlpha !== null && (e.blendEquationAlpha = this.blendEquationAlpha), this.blendColor && this.blendColor.isColor && (e.blendColor = this.blendColor.getHex()), this.blendAlpha !== 0 && (e.blendAlpha = this.blendAlpha), this.depthFunc !== 3 && (e.depthFunc = this.depthFunc), this.depthTest === !1 && (e.depthTest = this.depthTest), this.depthWrite === !1 && (e.depthWrite = this.depthWrite), this.colorWrite === !1 && (e.colorWrite = this.colorWrite), this.stencilWriteMask !== 255 && (e.stencilWriteMask = this.stencilWriteMask), this.stencilFunc !== 519 && (e.stencilFunc = this.stencilFunc), this.stencilRef !== 0 && (e.stencilRef = this.stencilRef), this.stencilFuncMask !== 255 && (e.stencilFuncMask = this.stencilFuncMask), this.stencilFail !== 7680 && (e.stencilFail = this.stencilFail), this.stencilZFail !== 7680 && (e.stencilZFail = this.stencilZFail), this.stencilZPass !== 7680 && (e.stencilZPass = this.stencilZPass), this.stencilWrite === !0 && (e.stencilWrite = this.stencilWrite), this.rotation !== void 0 && this.rotation !== 0 && (e.rotation = this.rotation), this.polygonOffset === !0 && (e.polygonOffset = !0), this.polygonOffsetFactor !== 0 && (e.polygonOffsetFactor = this.polygonOffsetFactor), this.polygonOffsetUnits !== 0 && (e.polygonOffsetUnits = this.polygonOffsetUnits), this.linewidth !== void 0 && this.linewidth !== 1 && (e.linewidth = this.linewidth), this.dashSize !== void 0 && (e.dashSize = this.dashSize), this.gapSize !== void 0 && (e.gapSize = this.gapSize), this.scale !== void 0 && (e.scale = this.scale), this.dithering === !0 && (e.dithering = !0), this.alphaTest > 0 && (e.alphaTest = this.alphaTest), this.alphaHash === !0 && (e.alphaHash = !0), this.alphaToCoverage === !0 && (e.alphaToCoverage = !0), this.premultipliedAlpha === !0 && (e.premultipliedAlpha = !0), this.forceSinglePass === !0 && (e.forceSinglePass = !0), this.allowOverride === !1 && (e.allowOverride = !1), this.wireframe === !0 && (e.wireframe = !0), this.wireframeLinewidth > 1 && (e.wireframeLinewidth = this.wireframeLinewidth), this.wireframeLinecap !== "round" && (e.wireframeLinecap = this.wireframeLinecap), this.wireframeLinejoin !== "round" && (e.wireframeLinejoin = this.wireframeLinejoin), this.flatShading === !0 && (e.flatShading = !0), this.visible === !1 && (e.visible = !1), this.toneMapped === !1 && (e.toneMapped = !1), this.fog === !1 && (e.fog = !1), Object.keys(this.userData).length > 0 && (e.userData = this.userData);
			function s(r) {
				const n = [];
				for (const o in r) {
					const a = r[o];
					delete a.metadata, n.push(a);
				}
				return n;
			}
			if (t) {
				const r = s(i.textures), n = s(i.images);
				r.length > 0 && (e.textures = r), n.length > 0 && (e.images = n);
			}
			return e;
		}
		clone() {
			return new this.constructor().copy(this);
		}
		copy(i) {
			this.name = i.name, this.blending = i.blending, this.side = i.side, this.vertexColors = i.vertexColors, this.opacity = i.opacity, this.transparent = i.transparent, this.blendSrc = i.blendSrc, this.blendDst = i.blendDst, this.blendEquation = i.blendEquation, this.blendSrcAlpha = i.blendSrcAlpha, this.blendDstAlpha = i.blendDstAlpha, this.blendEquationAlpha = i.blendEquationAlpha, this.blendColor.copy(i.blendColor), this.blendAlpha = i.blendAlpha, this.depthFunc = i.depthFunc, this.depthTest = i.depthTest, this.depthWrite = i.depthWrite, this.stencilWriteMask = i.stencilWriteMask, this.stencilFunc = i.stencilFunc, this.stencilRef = i.stencilRef, this.stencilFuncMask = i.stencilFuncMask, this.stencilFail = i.stencilFail, this.stencilZFail = i.stencilZFail, this.stencilZPass = i.stencilZPass, this.stencilWrite = i.stencilWrite;
			const t = i.clippingPlanes;
			let e = null;
			if (t !== null) {
				const s = t.length;
				e = new Array(s);
				for (let r = 0; r !== s; ++r) e[r] = t[r].clone();
			}
			return this.clippingPlanes = e, this.clipIntersection = i.clipIntersection, this.clipShadows = i.clipShadows, this.shadowSide = i.shadowSide, this.colorWrite = i.colorWrite, this.precision = i.precision, this.polygonOffset = i.polygonOffset, this.polygonOffsetFactor = i.polygonOffsetFactor, this.polygonOffsetUnits = i.polygonOffsetUnits, this.dithering = i.dithering, this.alphaTest = i.alphaTest, this.alphaHash = i.alphaHash, this.alphaToCoverage = i.alphaToCoverage, this.premultipliedAlpha = i.premultipliedAlpha, this.forceSinglePass = i.forceSinglePass, this.allowOverride = i.allowOverride, this.visible = i.visible, this.toneMapped = i.toneMapped, this.userData = JSON.parse(JSON.stringify(i.userData)), this;
		}
		dispose() {
			this.dispatchEvent({ type: "dispose" });
		}
		set needsUpdate(i) {
			i === !0 && this.version++;
		}
	};
	const st = new x(), Re = new x(), Qt = new x(), lt = new x(), Fe = new x(), Kt = new x(), Pe = new x();
	var Xi = class {
		constructor(i = new x(), t = new x(0, 0, -1)) {
			this.origin = i, this.direction = t;
		}
		set(i, t) {
			return this.origin.copy(i), this.direction.copy(t), this;
		}
		copy(i) {
			return this.origin.copy(i.origin), this.direction.copy(i.direction), this;
		}
		at(i, t) {
			return t.copy(this.origin).addScaledVector(this.direction, i);
		}
		lookAt(i) {
			return this.direction.copy(i).sub(this.origin).normalize(), this;
		}
		recast(i) {
			return this.origin.copy(this.at(i, st)), this;
		}
		closestPointToPoint(i, t) {
			t.subVectors(i, this.origin);
			const e = t.dot(this.direction);
			return e < 0 ? t.copy(this.origin) : t.copy(this.origin).addScaledVector(this.direction, e);
		}
		distanceToPoint(i) {
			return Math.sqrt(this.distanceSqToPoint(i));
		}
		distanceSqToPoint(i) {
			const t = st.subVectors(i, this.origin).dot(this.direction);
			return t < 0 ? this.origin.distanceToSquared(i) : (st.copy(this.origin).addScaledVector(this.direction, t), st.distanceToSquared(i));
		}
		distanceSqToSegment(i, t, e, s) {
			Re.copy(i).add(t).multiplyScalar(.5), Qt.copy(t).sub(i).normalize(), lt.copy(this.origin).sub(Re);
			const r = i.distanceTo(t) * .5, n = -this.direction.dot(Qt), o = lt.dot(this.direction), a = -lt.dot(Qt), l = lt.lengthSq(), h = Math.abs(1 - n * n);
			let c, u, d, p;
			if (h > 0) if (c = n * a - o, u = n * o - a, p = r * h, c >= 0) if (u >= -p) if (u <= p) {
				const m = 1 / h;
				c *= m, u *= m, d = c * (c + n * u + 2 * o) + u * (n * c + u + 2 * a) + l;
			} else u = r, c = Math.max(0, -(n * u + o)), d = -c * c + u * (u + 2 * a) + l;
			else u = -r, c = Math.max(0, -(n * u + o)), d = -c * c + u * (u + 2 * a) + l;
			else u <= -p ? (c = Math.max(0, -(-n * r + o)), u = c > 0 ? -r : Math.min(Math.max(-r, -a), r), d = -c * c + u * (u + 2 * a) + l) : u <= p ? (c = 0, u = Math.min(Math.max(-r, -a), r), d = u * (u + 2 * a) + l) : (c = Math.max(0, -(n * r + o)), u = c > 0 ? r : Math.min(Math.max(-r, -a), r), d = -c * c + u * (u + 2 * a) + l);
			else u = n > 0 ? -r : r, c = Math.max(0, -(n * u + o)), d = -c * c + u * (u + 2 * a) + l;
			return e && e.copy(this.origin).addScaledVector(this.direction, c), s && s.copy(Re).addScaledVector(Qt, u), d;
		}
		intersectSphere(i, t) {
			st.subVectors(i.center, this.origin);
			const e = st.dot(this.direction), s = st.dot(st) - e * e, r = i.radius * i.radius;
			if (s > r) return null;
			const n = Math.sqrt(r - s), o = e - n, a = e + n;
			return a < 0 ? null : o < 0 ? this.at(a, t) : this.at(o, t);
		}
		intersectsSphere(i) {
			return i.radius < 0 ? !1 : this.distanceSqToPoint(i.center) <= i.radius * i.radius;
		}
		distanceToPlane(i) {
			const t = i.normal.dot(this.direction);
			if (t === 0) return i.distanceToPoint(this.origin) === 0 ? 0 : null;
			const e = -(this.origin.dot(i.normal) + i.constant) / t;
			return e >= 0 ? e : null;
		}
		intersectPlane(i, t) {
			const e = this.distanceToPlane(i);
			return e === null ? null : this.at(e, t);
		}
		intersectsPlane(i) {
			const t = i.distanceToPoint(this.origin);
			return t === 0 || i.normal.dot(this.direction) * t < 0;
		}
		intersectBox(i, t) {
			let e, s, r, n, o, a;
			const l = 1 / this.direction.x, h = 1 / this.direction.y, c = 1 / this.direction.z, u = this.origin;
			return l >= 0 ? (e = (i.min.x - u.x) * l, s = (i.max.x - u.x) * l) : (e = (i.max.x - u.x) * l, s = (i.min.x - u.x) * l), h >= 0 ? (r = (i.min.y - u.y) * h, n = (i.max.y - u.y) * h) : (r = (i.max.y - u.y) * h, n = (i.min.y - u.y) * h), e > n || r > s || ((r > e || isNaN(e)) && (e = r), (n < s || isNaN(s)) && (s = n), c >= 0 ? (o = (i.min.z - u.z) * c, a = (i.max.z - u.z) * c) : (o = (i.max.z - u.z) * c, a = (i.min.z - u.z) * c), e > a || o > s) || ((o > e || e !== e) && (e = o), (a < s || s !== s) && (s = a), s < 0) ? null : this.at(e >= 0 ? e : s, t);
		}
		intersectsBox(i) {
			return this.intersectBox(i, st) !== null;
		}
		intersectTriangle(i, t, e, s, r) {
			Fe.subVectors(t, i), Kt.subVectors(e, i), Pe.crossVectors(Fe, Kt);
			let n = this.direction.dot(Pe), o;
			if (n > 0) {
				if (s) return null;
				o = 1;
			} else if (n < 0) o = -1, n = -n;
			else return null;
			lt.subVectors(this.origin, i);
			const a = o * this.direction.dot(Kt.crossVectors(lt, Kt));
			if (a < 0) return null;
			const l = o * this.direction.dot(Fe.cross(lt));
			if (l < 0 || a + l > n) return null;
			const h = -o * lt.dot(Pe);
			return h < 0 ? null : this.at(h / n, r);
		}
		applyMatrix4(i) {
			return this.origin.applyMatrix4(i), this.direction.transformDirection(i), this;
		}
		equals(i) {
			return i.origin.equals(this.origin) && i.direction.equals(this.direction);
		}
		clone() {
			return new this.constructor().copy(this);
		}
	}, ci = class extends ji {
		constructor(i) {
			super(), this.isMeshBasicMaterial = !0, this.type = "MeshBasicMaterial", this.color = new Zt(16777215), this.map = null, this.lightMap = null, this.lightMapIntensity = 1, this.aoMap = null, this.aoMapIntensity = 1, this.specularMap = null, this.alphaMap = null, this.envMap = null, this.envMapRotation = new ze(), this.combine = 0, this.reflectivity = 1, this.refractionRatio = .98, this.wireframe = !1, this.wireframeLinewidth = 1, this.wireframeLinecap = "round", this.wireframeLinejoin = "round", this.fog = !0, this.setValues(i);
		}
		copy(i) {
			return super.copy(i), this.color.copy(i.color), this.map = i.map, this.lightMap = i.lightMap, this.lightMapIntensity = i.lightMapIntensity, this.aoMap = i.aoMap, this.aoMapIntensity = i.aoMapIntensity, this.specularMap = i.specularMap, this.alphaMap = i.alphaMap, this.envMap = i.envMap, this.envMapRotation.copy(i.envMapRotation), this.combine = i.combine, this.reflectivity = i.reflectivity, this.refractionRatio = i.refractionRatio, this.wireframe = i.wireframe, this.wireframeLinewidth = i.wireframeLinewidth, this.wireframeLinecap = i.wireframeLinecap, this.wireframeLinejoin = i.wireframeLinejoin, this.fog = i.fog, this;
		}
	};
	const ui = new rt(), dt = new Xi(), te = new hi(), di = new x(), ee = new x(), ie = new x(), se = new x(), De = new x(), re = new x(), pi = new x(), ne = new x();
	var Zi = class extends Vt {
		constructor(i = new li(), t = new ci()) {
			super(), this.isMesh = !0, this.type = "Mesh", this.geometry = i, this.material = t, this.morphTargetDictionary = void 0, this.morphTargetInfluences = void 0, this.count = 1, this.updateMorphTargets();
		}
		copy(i, t) {
			return super.copy(i, t), i.morphTargetInfluences !== void 0 && (this.morphTargetInfluences = i.morphTargetInfluences.slice()), i.morphTargetDictionary !== void 0 && (this.morphTargetDictionary = Object.assign({}, i.morphTargetDictionary)), this.material = Array.isArray(i.material) ? i.material.slice() : i.material, this.geometry = i.geometry, this;
		}
		updateMorphTargets() {
			const i = this.geometry.morphAttributes, t = Object.keys(i);
			if (t.length > 0) {
				const e = i[t[0]];
				if (e !== void 0) {
					this.morphTargetInfluences = [], this.morphTargetDictionary = {};
					for (let s = 0, r = e.length; s < r; s++) {
						const n = e[s].name || String(s);
						this.morphTargetInfluences.push(0), this.morphTargetDictionary[n] = s;
					}
				}
			}
		}
		getVertexPosition(i, t) {
			const e = this.geometry, s = e.attributes.position, r = e.morphAttributes.position, n = e.morphTargetsRelative;
			t.fromBufferAttribute(s, i);
			const o = this.morphTargetInfluences;
			if (r && o) {
				re.set(0, 0, 0);
				for (let a = 0, l = r.length; a < l; a++) {
					const h = o[a], c = r[a];
					h !== 0 && (De.fromBufferAttribute(c, i), n ? re.addScaledVector(De, h) : re.addScaledVector(De.sub(t), h));
				}
				t.add(re);
			}
			return t;
		}
		raycast(i, t) {
			const e = this.geometry, s = this.material, r = this.matrixWorld;
			s !== void 0 && (e.boundingSphere === null && e.computeBoundingSphere(), te.copy(e.boundingSphere), te.applyMatrix4(r), dt.copy(i.ray).recast(i.near), !(te.containsPoint(dt.origin) === !1 && (dt.intersectSphere(te, di) === null || dt.origin.distanceToSquared(di) > (i.far - i.near) ** 2)) && (ui.copy(r).invert(), dt.copy(i.ray).applyMatrix4(ui), !(e.boundingBox !== null && dt.intersectsBox(e.boundingBox) === !1) && this._computeIntersections(i, t, dt)));
		}
		_computeIntersections(i, t, e) {
			let s;
			const r = this.geometry, n = this.material, o = r.index, a = r.attributes.position, l = r.attributes.uv, h = r.attributes.uv1, c = r.attributes.normal, u = r.groups, d = r.drawRange;
			if (o !== null) if (Array.isArray(n)) for (let p = 0, m = u.length; p < m; p++) {
				const f = u[p], y = n[f.materialIndex], g = Math.max(f.start, d.start), b = Math.min(o.count, Math.min(f.start + f.count, d.start + d.count));
				for (let _ = g, M = b; _ < M; _ += 3) {
					const w = o.getX(_), z = o.getX(_ + 1), S = o.getX(_ + 2);
					s = oe(this, y, i, e, l, h, c, w, z, S), s && (s.faceIndex = Math.floor(_ / 3), s.face.materialIndex = f.materialIndex, t.push(s));
				}
			}
			else {
				const p = Math.max(0, d.start), m = Math.min(o.count, d.start + d.count);
				for (let f = p, y = m; f < y; f += 3) {
					const g = o.getX(f), b = o.getX(f + 1), _ = o.getX(f + 2);
					s = oe(this, n, i, e, l, h, c, g, b, _), s && (s.faceIndex = Math.floor(f / 3), t.push(s));
				}
			}
			else if (a !== void 0) if (Array.isArray(n)) for (let p = 0, m = u.length; p < m; p++) {
				const f = u[p], y = n[f.materialIndex], g = Math.max(f.start, d.start), b = Math.min(a.count, Math.min(f.start + f.count, d.start + d.count));
				for (let _ = g, M = b; _ < M; _ += 3) {
					const w = _, z = _ + 1, S = _ + 2;
					s = oe(this, y, i, e, l, h, c, w, z, S), s && (s.faceIndex = Math.floor(_ / 3), s.face.materialIndex = f.materialIndex, t.push(s));
				}
			}
			else {
				const p = Math.max(0, d.start), m = Math.min(a.count, d.start + d.count);
				for (let f = p, y = m; f < y; f += 3) {
					const g = f, b = f + 1, _ = f + 2;
					s = oe(this, n, i, e, l, h, c, g, b, _), s && (s.faceIndex = Math.floor(f / 3), t.push(s));
				}
			}
		}
	};
	function Yi(i, t, e, s, r, n, o, a) {
		let l;
		if (t.side === 1 ? l = s.intersectTriangle(o, n, r, !0, a) : l = s.intersectTriangle(r, n, o, t.side === 0, a), l === null) return null;
		ne.copy(a), ne.applyMatrix4(i.matrixWorld);
		const h = e.ray.origin.distanceTo(ne);
		return h < e.near || h > e.far ? null : {
			distance: h,
			point: ne.clone(),
			object: i
		};
	}
	function oe(i, t, e, s, r, n, o, a, l, h) {
		i.getVertexPosition(a, ee), i.getVertexPosition(l, ie), i.getVertexPosition(h, se);
		const c = Yi(i, t, e, s, ee, ie, se, pi);
		if (c) {
			const u = new x();
			Et.getBarycoord(pi, ee, ie, se, u), r && (c.uv = Et.getInterpolatedAttribute(r, a, l, h, u, new $())), n && (c.uv1 = Et.getInterpolatedAttribute(n, a, l, h, u, new $())), o && (c.normal = Et.getInterpolatedAttribute(o, a, l, h, u, new x()), c.normal.dot(s.direction) > 0 && c.normal.multiplyScalar(-1));
			const d = {
				a,
				b: l,
				c: h,
				normal: new x(),
				materialIndex: 0
			};
			Et.getNormal(ee, ie, se, d.normal), c.face = d, c.barycoord = u;
		}
		return c;
	}
	function ae(i, t) {
		return !i || i.constructor === t ? i : typeof t.BYTES_PER_ELEMENT == "number" ? new t(i) : Array.prototype.slice.call(i);
	}
	var Pt = class {
		constructor(i, t, e, s) {
			this.parameterPositions = i, this._cachedIndex = 0, this.resultBuffer = s !== void 0 ? s : new t.constructor(e), this.sampleValues = t, this.valueSize = e, this.settings = null, this.DefaultSettings_ = {};
		}
		evaluate(i) {
			const t = this.parameterPositions;
			let e = this._cachedIndex, s = t[e], r = t[e - 1];
			t: {
				e: {
					let n;
					i: {
						s: if (!(i < s)) {
							for (let o = e + 2;;) {
								if (s === void 0) {
									if (i < r) break s;
									return e = t.length, this._cachedIndex = e, this.copySampleValue_(e - 1);
								}
								if (e === o) break;
								if (r = s, s = t[++e], i < s) break e;
							}
							n = t.length;
							break i;
						}
						if (!(i >= r)) {
							const o = t[1];
							i < o && (e = 2, r = o);
							for (let a = e - 2;;) {
								if (r === void 0) return this._cachedIndex = 0, this.copySampleValue_(0);
								if (e === a) break;
								if (s = r, r = t[--e - 1], i >= r) break e;
							}
							n = e, e = 0;
							break i;
						}
						break t;
					}
					for (; e < n;) {
						const o = e + n >>> 1;
						i < t[o] ? n = o : e = o + 1;
					}
					if (s = t[e], r = t[e - 1], r === void 0) return this._cachedIndex = 0, this.copySampleValue_(0);
					if (s === void 0) return e = t.length, this._cachedIndex = e, this.copySampleValue_(e - 1);
				}
				this._cachedIndex = e, this.intervalChanged_(e, r, s);
			}
			return this.interpolate_(e, r, i, s);
		}
		getSettings_() {
			return this.settings || this.DefaultSettings_;
		}
		copySampleValue_(i) {
			const t = this.resultBuffer, e = this.sampleValues, s = this.valueSize, r = i * s;
			for (let n = 0; n !== s; ++n) t[n] = e[r + n];
			return t;
		}
		interpolate_() {
			throw new Error("call to abstract method");
		}
		intervalChanged_() {}
	}, Hi = class extends Pt {
		constructor(i, t, e, s) {
			super(i, t, e, s), this._weightPrev = -0, this._offsetPrev = -0, this._weightNext = -0, this._offsetNext = -0, this.DefaultSettings_ = {
				endingStart: 2400,
				endingEnd: 2400
			};
		}
		intervalChanged_(i, t, e) {
			const s = this.parameterPositions;
			let r = i - 2, n = i + 1, o = s[r], a = s[n];
			if (o === void 0) switch (this.getSettings_().endingStart) {
				case 2401:
					r = i, o = 2 * t - e;
					break;
				case 2402:
					r = s.length - 2, o = t + s[r] - s[r + 1];
					break;
				default: r = i, o = e;
			}
			if (a === void 0) switch (this.getSettings_().endingEnd) {
				case 2401:
					n = i, a = 2 * e - t;
					break;
				case 2402:
					n = 1, a = e + s[1] - s[0];
					break;
				default: n = i - 1, a = t;
			}
			const l = (e - t) * .5, h = this.valueSize;
			this._weightPrev = l / (t - o), this._weightNext = l / (a - e), this._offsetPrev = r * h, this._offsetNext = n * h;
		}
		interpolate_(i, t, e, s) {
			const r = this.resultBuffer, n = this.sampleValues, o = this.valueSize, a = i * o, l = a - o, h = this._offsetPrev, c = this._offsetNext, u = this._weightPrev, d = this._weightNext, p = (e - t) / (s - t), m = p * p, f = m * p, y = -u * f + 2 * u * m - u * p, g = (1 + u) * f + (-1.5 - 2 * u) * m + (-.5 + u) * p + 1, b = (-1 - d) * f + (1.5 + d) * m + .5 * p, _ = d * f - d * m;
			for (let M = 0; M !== o; ++M) r[M] = y * n[h + M] + g * n[l + M] + b * n[a + M] + _ * n[c + M];
			return r;
		}
	}, Ji = class extends Pt {
		constructor(i, t, e, s) {
			super(i, t, e, s);
		}
		interpolate_(i, t, e, s) {
			const r = this.resultBuffer, n = this.sampleValues, o = this.valueSize, a = i * o, l = a - o, h = (e - t) / (s - t), c = 1 - h;
			for (let u = 0; u !== o; ++u) r[u] = n[l + u] * c + n[a + u] * h;
			return r;
		}
	}, Gi = class extends Pt {
		constructor(i, t, e, s) {
			super(i, t, e, s);
		}
		interpolate_(i) {
			return this.copySampleValue_(i - 1);
		}
	}, $i = class extends Pt {
		interpolate_(i, t, e, s) {
			const r = this.resultBuffer, n = this.sampleValues, o = this.valueSize, a = i * o, l = a - o, h = this.settings || this.DefaultSettings_, c = h.inTangents, u = h.outTangents;
			if (!c || !u) {
				const m = (e - t) / (s - t), f = 1 - m;
				for (let y = 0; y !== o; ++y) r[y] = n[l + y] * f + n[a + y] * m;
				return r;
			}
			const d = o * 2, p = i - 1;
			for (let m = 0; m !== o; ++m) {
				const f = n[l + m], y = n[a + m], g = p * d + m * 2, b = u[g], _ = u[g + 1], M = i * d + m * 2, w = c[M], z = c[M + 1];
				let S = (e - t) / (s - t), A, T, v, k, B;
				for (let I = 0; I < 8; I++) {
					A = S * S, T = A * S, v = 1 - S, k = v * v, B = k * v;
					const O = B * t + 3 * k * S * b + 3 * v * A * w + T * s - e;
					if (Math.abs(O) < 1e-10) break;
					const V = 3 * k * (b - t) + 6 * v * S * (w - b) + 3 * A * (s - w);
					if (Math.abs(V) < 1e-10) break;
					S = S - O / V, S = Math.max(0, Math.min(1, S));
				}
				r[m] = B * f + 3 * k * S * _ + 3 * v * A * z + T * y;
			}
			return r;
		}
	}, G = class {
		constructor(i, t, e, s) {
			if (i === void 0) throw new Error("THREE.KeyframeTrack: track name is undefined");
			if (t === void 0 || t.length === 0) throw new Error("THREE.KeyframeTrack: no keyframes in track named " + i);
			this.name = i, this.times = ae(t, this.TimeBufferType), this.values = ae(e, this.ValueBufferType), this.setInterpolation(s || this.DefaultInterpolation);
		}
		static toJSON(i) {
			const t = i.constructor;
			let e;
			if (t.toJSON !== this.toJSON) e = t.toJSON(i);
			else {
				e = {
					name: i.name,
					times: ae(i.times, Array),
					values: ae(i.values, Array)
				};
				const s = i.getInterpolation();
				s !== i.DefaultInterpolation && (e.interpolation = s);
			}
			return e.type = i.ValueTypeName, e;
		}
		InterpolantFactoryMethodDiscrete(i) {
			return new Gi(this.times, this.values, this.getValueSize(), i);
		}
		InterpolantFactoryMethodLinear(i) {
			return new Ji(this.times, this.values, this.getValueSize(), i);
		}
		InterpolantFactoryMethodSmooth(i) {
			return new Hi(this.times, this.values, this.getValueSize(), i);
		}
		InterpolantFactoryMethodBezier(i) {
			const t = new $i(this.times, this.values, this.getValueSize(), i);
			return this.settings && (t.settings = this.settings), t;
		}
		setInterpolation(i) {
			let t;
			switch (i) {
				case 2300:
					t = this.InterpolantFactoryMethodDiscrete;
					break;
				case 2301:
					t = this.InterpolantFactoryMethodLinear;
					break;
				case 2302:
					t = this.InterpolantFactoryMethodSmooth;
					break;
				case 2303:
					t = this.InterpolantFactoryMethodBezier;
					break;
			}
			if (t === void 0) {
				const e = "unsupported interpolation for " + this.ValueTypeName + " keyframe track named " + this.name;
				if (this.createInterpolant === void 0) if (i !== this.DefaultInterpolation) this.setInterpolation(this.DefaultInterpolation);
				else throw new Error(e);
				return F("KeyframeTrack:", e), this;
			}
			return this.createInterpolant = t, this;
		}
		getInterpolation() {
			switch (this.createInterpolant) {
				case this.InterpolantFactoryMethodDiscrete: return 2300;
				case this.InterpolantFactoryMethodLinear: return 2301;
				case this.InterpolantFactoryMethodSmooth: return 2302;
				case this.InterpolantFactoryMethodBezier: return 2303;
			}
		}
		getValueSize() {
			return this.values.length / this.times.length;
		}
		shift(i) {
			if (i !== 0) {
				const t = this.times;
				for (let e = 0, s = t.length; e !== s; ++e) t[e] += i;
			}
			return this;
		}
		scale(i) {
			if (i !== 1) {
				const t = this.times;
				for (let e = 0, s = t.length; e !== s; ++e) t[e] *= i;
			}
			return this;
		}
		trim(i, t) {
			const e = this.times, s = e.length;
			let r = 0, n = s - 1;
			for (; r !== s && e[r] < i;) ++r;
			for (; n !== -1 && e[n] > t;) --n;
			if (++n, r !== 0 || n !== s) {
				r >= n && (n = Math.max(n, 1), r = n - 1);
				const o = this.getValueSize();
				this.times = e.slice(r, n), this.values = this.values.slice(r * o, n * o);
			}
			return this;
		}
		validate() {
			let i = !0;
			const t = this.getValueSize();
			t - Math.floor(t) !== 0 && (E("KeyframeTrack: Invalid value size in track.", this), i = !1);
			const e = this.times, s = this.values, r = e.length;
			r === 0 && (E("KeyframeTrack: Track is empty.", this), i = !1);
			let n = null;
			for (let o = 0; o !== r; o++) {
				const a = e[o];
				if (typeof a == "number" && isNaN(a)) {
					E("KeyframeTrack: Time is not a valid number.", this, o, a), i = !1;
					break;
				}
				if (n !== null && n > a) {
					E("KeyframeTrack: Out of order keys.", this, o, a, n), i = !1;
					break;
				}
				n = a;
			}
			if (s !== void 0 && Si(s)) for (let o = 0, a = s.length; o !== a; ++o) {
				const l = s[o];
				if (isNaN(l)) {
					E("KeyframeTrack: Value is not a valid number.", this, o, l), i = !1;
					break;
				}
			}
			return i;
		}
		optimize() {
			const i = this.times.slice(), t = this.values.slice(), e = this.getValueSize(), s = this.getInterpolation() === 2302, r = i.length - 1;
			let n = 1;
			for (let o = 1; o < r; ++o) {
				let a = !1;
				const l = i[o];
				if (l !== i[o + 1] && (o !== 1 || l !== i[0])) if (s) a = !0;
				else {
					const h = o * e, c = h - e, u = h + e;
					for (let d = 0; d !== e; ++d) {
						const p = t[h + d];
						if (p !== t[c + d] || p !== t[u + d]) {
							a = !0;
							break;
						}
					}
				}
				if (a) {
					if (o !== n) {
						i[n] = i[o];
						const h = o * e, c = n * e;
						for (let u = 0; u !== e; ++u) t[c + u] = t[h + u];
					}
					++n;
				}
			}
			if (r > 0) {
				i[n] = i[r];
				for (let o = r * e, a = n * e, l = 0; l !== e; ++l) t[a + l] = t[o + l];
				++n;
			}
			return n !== i.length ? (this.times = i.slice(0, n), this.values = t.slice(0, n * e)) : (this.times = i, this.values = t), this;
		}
		clone() {
			const i = this.times.slice(), t = this.values.slice(), e = this.constructor, s = new e(this.name, i, t);
			return s.createInterpolant = this.createInterpolant, s;
		}
	};
	G.prototype.ValueTypeName = "", G.prototype.TimeBufferType = Float32Array, G.prototype.ValueBufferType = Float32Array, G.prototype.DefaultInterpolation = 2301;
	var Dt = class extends G {
		constructor(i, t, e) {
			super(i, t, e);
		}
	};
	Dt.prototype.ValueTypeName = "bool", Dt.prototype.ValueBufferType = Array, Dt.prototype.DefaultInterpolation = 2300, Dt.prototype.InterpolantFactoryMethodLinear = void 0, Dt.prototype.InterpolantFactoryMethodSmooth = void 0;
	var Qi = class extends G {
		constructor(i, t, e, s) {
			super(i, t, e, s);
		}
	};
	Qi.prototype.ValueTypeName = "color";
	var Ki = class extends G {
		constructor(i, t, e, s) {
			super(i, t, e, s);
		}
	};
	Ki.prototype.ValueTypeName = "number";
	var ts = class extends Pt {
		constructor(i, t, e, s) {
			super(i, t, e, s);
		}
		interpolate_(i, t, e, s) {
			const r = this.resultBuffer, n = this.sampleValues, o = this.valueSize, a = (e - t) / (s - t);
			let l = i * o;
			for (let h = l + o; l !== h; l += 4) pt.slerpFlat(r, 0, n, l - o, n, l, a);
			return r;
		}
	}, mi = class extends G {
		constructor(i, t, e, s) {
			super(i, t, e, s);
		}
		InterpolantFactoryMethodLinear(i) {
			return new ts(this.times, this.values, this.getValueSize(), i);
		}
	};
	mi.prototype.ValueTypeName = "quaternion", mi.prototype.InterpolantFactoryMethodSmooth = void 0;
	var Ut = class extends G {
		constructor(i, t, e) {
			super(i, t, e);
		}
	};
	Ut.prototype.ValueTypeName = "string", Ut.prototype.ValueBufferType = Array, Ut.prototype.DefaultInterpolation = 2300, Ut.prototype.InterpolantFactoryMethodLinear = void 0, Ut.prototype.InterpolantFactoryMethodSmooth = void 0;
	var es = class extends G {
		constructor(i, t, e, s) {
			super(i, t, e, s);
		}
	};
	es.prototype.ValueTypeName = "vector";
	var is = class {
		constructor(i, t, e) {
			const s = this;
			let r = !1, n = 0, o = 0, a;
			const l = [];
			this.onStart = void 0, this.onLoad = i, this.onProgress = t, this.onError = e, this._abortController = null, this.itemStart = function(h) {
				o++, r === !1 && s.onStart !== void 0 && s.onStart(h, n, o), r = !0;
			}, this.itemEnd = function(h) {
				n++, s.onProgress !== void 0 && s.onProgress(h, n, o), n === o && (r = !1, s.onLoad !== void 0 && s.onLoad());
			}, this.itemError = function(h) {
				s.onError !== void 0 && s.onError(h);
			}, this.resolveURL = function(h) {
				return a ? a(h) : h;
			}, this.setURLModifier = function(h) {
				return a = h, this;
			}, this.addHandler = function(h, c) {
				return l.push(h, c), this;
			}, this.removeHandler = function(h) {
				const c = l.indexOf(h);
				return c !== -1 && l.splice(c, 2), this;
			}, this.getHandler = function(h) {
				for (let c = 0, u = l.length; c < u; c += 2) {
					const d = l[c], p = l[c + 1];
					if (d.global && (d.lastIndex = 0), d.test(h)) return p;
				}
				return null;
			}, this.abort = function() {
				return this.abortController.abort(), this._abortController = null, this;
			};
		}
		get abortController() {
			return this._abortController || (this._abortController = new AbortController()), this._abortController;
		}
	};
	const ss = new is();
	var rs = class {
		constructor(i) {
			this.manager = i !== void 0 ? i : ss, this.crossOrigin = "anonymous", this.withCredentials = !1, this.path = "", this.resourcePath = "", this.requestHeader = {}, typeof __THREE_DEVTOOLS__ < "u" && __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", { detail: this }));
		}
		load() {}
		loadAsync(i, t) {
			const e = this;
			return new Promise(function(s, r) {
				e.load(i, s, t, r);
			});
		}
		parse() {}
		setCrossOrigin(i) {
			return this.crossOrigin = i, this;
		}
		setWithCredentials(i) {
			return this.withCredentials = i, this;
		}
		setPath(i) {
			return this.path = i, this;
		}
		setResourcePath(i) {
			return this.resourcePath = i, this;
		}
		setRequestHeader(i) {
			return this.requestHeader = i, this;
		}
		abort() {
			return this;
		}
	};
	rs.DEFAULT_MATERIAL_NAME = "__DEFAULT";
	const Ue = "\\[\\]\\.:\\/", ns = new RegExp("[" + Ue + "]", "g"), We = "[^" + Ue + "]", os = "[^" + Ue.replace("\\.", "") + "]", as = /((?:WC+[\/:])*)/.source.replace("WC", We), hs = /(WCOD+)?/.source.replace("WCOD", os), ls = /(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC", We), cs = /\.(WC+)(?:\[(.+)\])?/.source.replace("WC", We), us = new RegExp("^" + as + hs + ls + cs + "$"), ds = [
		"material",
		"materials",
		"bones",
		"map"
	];
	var ps = class {
		constructor(i, t, e) {
			const s = e || N.parseTrackName(t);
			this._targetGroup = i, this._bindings = i.subscribe_(t, s);
		}
		getValue(i, t) {
			this.bind();
			const e = this._targetGroup.nCachedObjects_, s = this._bindings[e];
			s !== void 0 && s.getValue(i, t);
		}
		setValue(i, t) {
			const e = this._bindings;
			for (let s = this._targetGroup.nCachedObjects_, r = e.length; s !== r; ++s) e[s].setValue(i, t);
		}
		bind() {
			const i = this._bindings;
			for (let t = this._targetGroup.nCachedObjects_, e = i.length; t !== e; ++t) i[t].bind();
		}
		unbind() {
			const i = this._bindings;
			for (let t = this._targetGroup.nCachedObjects_, e = i.length; t !== e; ++t) i[t].unbind();
		}
	}, N = class Ct {
		constructor(t, e, s) {
			this.path = e, this.parsedPath = s || Ct.parseTrackName(e), this.node = Ct.findNode(t, this.parsedPath.nodeName), this.rootNode = t, this.getValue = this._getValue_unbound, this.setValue = this._setValue_unbound;
		}
		static create(t, e, s) {
			return t && t.isAnimationObjectGroup ? new Ct.Composite(t, e, s) : new Ct(t, e, s);
		}
		static sanitizeNodeName(t) {
			return t.replace(/\s/g, "_").replace(ns, "");
		}
		static parseTrackName(t) {
			const e = us.exec(t);
			if (e === null) throw new Error("PropertyBinding: Cannot parse trackName: " + t);
			const s = {
				nodeName: e[2],
				objectName: e[3],
				objectIndex: e[4],
				propertyName: e[5],
				propertyIndex: e[6]
			}, r = s.nodeName && s.nodeName.lastIndexOf(".");
			if (r !== void 0 && r !== -1) {
				const n = s.nodeName.substring(r + 1);
				ds.indexOf(n) !== -1 && (s.nodeName = s.nodeName.substring(0, r), s.objectName = n);
			}
			if (s.propertyName === null || s.propertyName.length === 0) throw new Error("PropertyBinding: can not parse propertyName from trackName: " + t);
			return s;
		}
		static findNode(t, e) {
			if (e === void 0 || e === "" || e === "." || e === -1 || e === t.name || e === t.uuid) return t;
			if (t.skeleton) {
				const s = t.skeleton.getBoneByName(e);
				if (s !== void 0) return s;
			}
			if (t.children) {
				const s = function(n) {
					for (let o = 0; o < n.length; o++) {
						const a = n[o];
						if (a.name === e || a.uuid === e) return a;
						const l = s(a.children);
						if (l) return l;
					}
					return null;
				}, r = s(t.children);
				if (r) return r;
			}
			return null;
		}
		_getValue_unavailable() {}
		_setValue_unavailable() {}
		_getValue_direct(t, e) {
			t[e] = this.targetObject[this.propertyName];
		}
		_getValue_array(t, e) {
			const s = this.resolvedProperty;
			for (let r = 0, n = s.length; r !== n; ++r) t[e++] = s[r];
		}
		_getValue_arrayElement(t, e) {
			t[e] = this.resolvedProperty[this.propertyIndex];
		}
		_getValue_toArray(t, e) {
			this.resolvedProperty.toArray(t, e);
		}
		_setValue_direct(t, e) {
			this.targetObject[this.propertyName] = t[e];
		}
		_setValue_direct_setNeedsUpdate(t, e) {
			this.targetObject[this.propertyName] = t[e], this.targetObject.needsUpdate = !0;
		}
		_setValue_direct_setMatrixWorldNeedsUpdate(t, e) {
			this.targetObject[this.propertyName] = t[e], this.targetObject.matrixWorldNeedsUpdate = !0;
		}
		_setValue_array(t, e) {
			const s = this.resolvedProperty;
			for (let r = 0, n = s.length; r !== n; ++r) s[r] = t[e++];
		}
		_setValue_array_setNeedsUpdate(t, e) {
			const s = this.resolvedProperty;
			for (let r = 0, n = s.length; r !== n; ++r) s[r] = t[e++];
			this.targetObject.needsUpdate = !0;
		}
		_setValue_array_setMatrixWorldNeedsUpdate(t, e) {
			const s = this.resolvedProperty;
			for (let r = 0, n = s.length; r !== n; ++r) s[r] = t[e++];
			this.targetObject.matrixWorldNeedsUpdate = !0;
		}
		_setValue_arrayElement(t, e) {
			this.resolvedProperty[this.propertyIndex] = t[e];
		}
		_setValue_arrayElement_setNeedsUpdate(t, e) {
			this.resolvedProperty[this.propertyIndex] = t[e], this.targetObject.needsUpdate = !0;
		}
		_setValue_arrayElement_setMatrixWorldNeedsUpdate(t, e) {
			this.resolvedProperty[this.propertyIndex] = t[e], this.targetObject.matrixWorldNeedsUpdate = !0;
		}
		_setValue_fromArray(t, e) {
			this.resolvedProperty.fromArray(t, e);
		}
		_setValue_fromArray_setNeedsUpdate(t, e) {
			this.resolvedProperty.fromArray(t, e), this.targetObject.needsUpdate = !0;
		}
		_setValue_fromArray_setMatrixWorldNeedsUpdate(t, e) {
			this.resolvedProperty.fromArray(t, e), this.targetObject.matrixWorldNeedsUpdate = !0;
		}
		_getValue_unbound(t, e) {
			this.bind(), this.getValue(t, e);
		}
		_setValue_unbound(t, e) {
			this.bind(), this.setValue(t, e);
		}
		bind() {
			let t = this.node;
			const e = this.parsedPath, s = e.objectName, r = e.propertyName;
			let n = e.propertyIndex;
			if (t || (t = Ct.findNode(this.rootNode, e.nodeName), this.node = t), this.getValue = this._getValue_unavailable, this.setValue = this._setValue_unavailable, !t) {
				F("PropertyBinding: No target node found for track: " + this.path + ".");
				return;
			}
			if (s) {
				let h = e.objectIndex;
				switch (s) {
					case "materials":
						if (!t.material) {
							E("PropertyBinding: Can not bind to material as node does not have a material.", this);
							return;
						}
						if (!t.material.materials) {
							E("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.", this);
							return;
						}
						t = t.material.materials;
						break;
					case "bones":
						if (!t.skeleton) {
							E("PropertyBinding: Can not bind to bones as node does not have a skeleton.", this);
							return;
						}
						t = t.skeleton.bones;
						for (let c = 0; c < t.length; c++) if (t[c].name === h) {
							h = c;
							break;
						}
						break;
					case "map":
						if ("map" in t) {
							t = t.map;
							break;
						}
						if (!t.material) {
							E("PropertyBinding: Can not bind to material as node does not have a material.", this);
							return;
						}
						if (!t.material.map) {
							E("PropertyBinding: Can not bind to material.map as node.material does not have a map.", this);
							return;
						}
						t = t.material.map;
						break;
					default:
						if (t[s] === void 0) {
							E("PropertyBinding: Can not bind to objectName of node undefined.", this);
							return;
						}
						t = t[s];
				}
				if (h !== void 0) {
					if (t[h] === void 0) {
						E("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.", this, t);
						return;
					}
					t = t[h];
				}
			}
			const o = t[r];
			if (o === void 0) {
				const h = e.nodeName;
				E("PropertyBinding: Trying to update property for track: " + h + "." + r + " but it wasn't found.", t);
				return;
			}
			let a = this.Versioning.None;
			this.targetObject = t, t.isMaterial === !0 ? a = this.Versioning.NeedsUpdate : t.isObject3D === !0 && (a = this.Versioning.MatrixWorldNeedsUpdate);
			let l = this.BindingType.Direct;
			if (n !== void 0) {
				if (r === "morphTargetInfluences") {
					if (!t.geometry) {
						E("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.", this);
						return;
					}
					if (!t.geometry.morphAttributes) {
						E("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.", this);
						return;
					}
					t.morphTargetDictionary[n] !== void 0 && (n = t.morphTargetDictionary[n]);
				}
				l = this.BindingType.ArrayElement, this.resolvedProperty = o, this.propertyIndex = n;
			} else o.fromArray !== void 0 && o.toArray !== void 0 ? (l = this.BindingType.HasFromToArray, this.resolvedProperty = o) : Array.isArray(o) ? (l = this.BindingType.EntireArray, this.resolvedProperty = o) : this.propertyName = r;
			this.getValue = this.GetterByBindingType[l], this.setValue = this.SetterByBindingTypeAndVersioning[l][a];
		}
		unbind() {
			this.node = null, this.getValue = this._getValue_unbound, this.setValue = this._setValue_unbound;
		}
	};
	N.Composite = ps, N.prototype.BindingType = {
		Direct: 0,
		EntireArray: 1,
		ArrayElement: 2,
		HasFromToArray: 3
	}, N.prototype.Versioning = {
		None: 0,
		NeedsUpdate: 1,
		MatrixWorldNeedsUpdate: 2
	}, N.prototype.GetterByBindingType = [
		N.prototype._getValue_direct,
		N.prototype._getValue_array,
		N.prototype._getValue_arrayElement,
		N.prototype._getValue_toArray
	], N.prototype.SetterByBindingTypeAndVersioning = [
		[
			N.prototype._setValue_direct,
			N.prototype._setValue_direct_setNeedsUpdate,
			N.prototype._setValue_direct_setMatrixWorldNeedsUpdate
		],
		[
			N.prototype._setValue_array,
			N.prototype._setValue_array_setNeedsUpdate,
			N.prototype._setValue_array_setMatrixWorldNeedsUpdate
		],
		[
			N.prototype._setValue_arrayElement,
			N.prototype._setValue_arrayElement_setNeedsUpdate,
			N.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate
		],
		[
			N.prototype._setValue_fromArray,
			N.prototype._setValue_fromArray_setNeedsUpdate,
			N.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate
		]
	], typeof __THREE_DEVTOOLS__ < "u" && __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register", { detail: { revision: "183" } })), typeof window < "u" && (window.__THREE__ ? F("WARNING: Multiple instances of Three.js being imported.") : window.__THREE__ = "183");
	const ms = (i, t) => Math.abs(i[0] - t[0]) < 1e-7 && Math.abs(i[1] - t[1]) < 1e-7 && Math.abs(i[2] - t[2]) < 1e-7;
	function Le(i, t) {
		const e = i.filter((n, o) => !ms(n, i[(o + i.length - 1) % i.length]));
		if (e.length < 3) return;
		let s = 0;
		for (let n = 1; n < e.length; n++) {
			const o = e[n], a = e[s];
			(o[0] < a[0] || o[0] === a[0] && (o[1] < a[1] || o[1] === a[1] && o[2] < a[2])) && (s = n);
		}
		const r = e[s];
		for (let n = 1; n + 1 < e.length; n++) {
			const o = e[(s + n) % e.length], a = e[(s + n + 1) % e.length], l = o[0] - r[0], h = o[1] - r[1], c = o[2] - r[2], u = a[0] - r[0], d = a[1] - r[1], p = a[2] - r[2];
			(h * p - c * d) ** 2 + (c * u - l * p) ** 2 + (l * d - h * u) ** 2 > 1e-16 && t.push(...r, ...o, ...a);
		}
	}
	function fi(i, t) {
		const e = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map();
		let r = 0;
		const n = (a) => {
			const l = Math.round(i[a] * 1e6), h = Math.round(i[a + 1] * 1e6), c = Math.round(i[a + 2] * 1e6);
			let u = s.get(l);
			u || (u = /* @__PURE__ */ new Map(), s.set(l, u));
			let d = u.get(h);
			d || (d = /* @__PURE__ */ new Map(), u.set(h, d));
			let p = d.get(c);
			return p === void 0 && (p = r++, d.set(c, p)), p;
		};
		for (let a = 0; a + 8 < i.length; a += 9) {
			let l = n(a), h = n(a + 3), c = n(a + 6), u = 1;
			if (l === h || h === c || l === c) continue;
			if (l > h) {
				const m = l;
				l = h, h = m, u = -u;
			}
			if (h > c) {
				const m = h;
				h = c, c = m, u = -u;
			}
			if (l > h) {
				const m = l;
				l = h, h = m, u = -u;
			}
			const d = `${t?.(a) ?? ""}|${l},${h},${c}`, p = e.get(d);
			p ? p.orientation !== u && (p.internal = !0) : e.set(d, {
				offset: a,
				orientation: u,
				internal: !1
			});
		}
		const o = [];
		for (const a of e.values()) a.internal || o.push(a.offset);
		return {
			offsets: o,
			removedTriangleCount: i.length / 9 - o.length
		};
	}
	function fs(i) {
		return (i.logicalCellId ? `${i.logicalCellId}:${i.y}` : `${i.x}:${i.y}:${i.z}`) + (i.minimumY === void 0 ? "" : `:${i.minimumY}:${i.maximumY}`);
	}
	function ys(i, t, e = 1) {
		const s = [...new Map(i.map((m) => [fs(m), m])).values()], r = [], n = [], o = [], a = [], l = [], h = (m) => {
			const f = r[m], y = r[m + 1], g = r[m + 2], b = r[m + 3] - f, _ = r[m + 4] - y, M = r[m + 5] - g, w = r[m + 6] - f, z = r[m + 7] - y, S = r[m + 8] - g, A = Math.abs(_ * S - M * z), T = Math.abs(M * w - b * S), v = Math.abs(b * z - _ * w), k = T >= Math.max(A, v), B = k ? 0 : A > v ? 2 : 0, I = k ? 2 : 1;
			for (let O = m; O < m + 9; O += 3) n.push(r[O] * e, r[O + 1] * e, r[O + 2] * e), o.push(r[O + B] * e, r[O + I] * e);
		};
		for (const m of s) {
			const f = r.length / 9, y = m.minimumY ?? m.y, g = m.maximumY ?? m.y + 1;
			for (const [b, _] of (m.footprintPolygons ?? [[
				[m.x, m.z],
				[m.x + 1, m.z],
				[m.x + 1, m.z + 1],
				[m.x, m.z + 1]
			]]).entries()) {
				const M = _.map((z, S) => ({
					point: z,
					bottom: m.minimumHeights?.[b]?.[S] ?? y,
					top: m.maximumHeights?.[b]?.[S] ?? g
				}));
				if (M.length > 1 && Math.hypot(M[0].point[0] - M.at(-1).point[0], M[0].point[1] - M.at(-1).point[1]) < 1e-8 && M.pop(), M.length < 3) continue;
				M.reduce((z, S, A) => {
					const T = S.point, v = M[(A + 1) % M.length].point;
					return z + T[0] * v[1] - v[0] * T[1];
				}, 0) < 0 && M.reverse();
				const w = (z, S) => [
					M[z].point[0],
					M[z][S],
					M[z].point[1]
				];
				Le(M.map((z, S) => w(S, "top")).reverse(), r), Le(M.map((z, S) => w(S, "bottom")), r);
				for (let z = 0; z < M.length; z += 1) {
					const S = (z + 1) % M.length;
					Le([
						w(z, "bottom"),
						w(z, "top"),
						w(S, "top"),
						w(S, "bottom")
					], r);
				}
			}
			l.push({
				firstTriangle: f,
				endTriangle: r.length / 9,
				cell: m
			});
		}
		const c = fi(r);
		let u = 0;
		for (const m of c.offsets) {
			for (; l[u].endTriangle <= m / 9;) u++;
			const f = l[u].cell, y = n.length / 9;
			h(m);
			const g = a.at(-1);
			g?.cell === f ? g.endTriangle = n.length / 9 : a.push({
				firstTriangle: y,
				endTriangle: n.length / 9,
				cell: f
			});
		}
		if (!n.length) return null;
		const d = new li();
		d.setAttribute("position", new $t(n, 3)), d.setAttribute("uv", new $t(o, 2)), d.computeVertexNormals(), d.computeBoundingSphere();
		const p = new Zi(d, t);
		return p.userData.constructionCellRanges = a, p.userData.constructionCellCount = s.length, p.userData.removedInteriorTriangleCount = c.removedTriangleCount, p.castShadow = !0, p.receiveShadow = !0, p;
	}
	function gs(i) {
		const t = /* @__PURE__ */ new Map();
		for (const s of i) {
			if (!s.userData.constructionCellRanges || s.geometry.index) continue;
			const r = s.userData.semanticObjectRef?.metadata, n = r?.generatedFromAreaId ?? r?.lod2BuildingId;
			if (typeof n != "string" || !n) continue;
			const o = t.get(n) ?? [];
			o.push(s), t.set(n, o);
		}
		let e = 0;
		for (const s of t.values()) {
			if (s.length < 2) continue;
			const r = [], n = [];
			for (const l of s) {
				const h = l.geometry.getAttribute("position"), c = r.length;
				for (let u = 0; u < h.count; u++) r.push(h.getX(u), h.getY(u), h.getZ(u));
				n.push({
					mesh: l,
					start: c,
					end: r.length
				});
			}
			const o = fi(r);
			e += o.removedTriangleCount;
			let a = 0;
			for (const { mesh: l, start: h, end: c } of n) {
				const u = [];
				for (; a < o.offsets.length && o.offsets[a] < c;) u.push(o.offsets[a++] - h);
				if (u.length * 9 === c - h) continue;
				const d = l.userData.constructionCellRanges, p = [];
				let m = 0;
				for (const [f, y] of u.entries()) {
					for (; d[m].endTriangle <= y / 9;) m++;
					const g = d[m].cell, b = p.at(-1);
					b?.cell === g ? b.endTriangle = f + 1 : p.push({
						firstTriangle: f,
						endTriangle: f + 1,
						cell: g
					});
				}
				for (const [f, y] of Object.entries(l.geometry.attributes)) {
					const g = y, b = new Float32Array(u.length * 3 * g.itemSize);
					let _ = 0;
					for (const M of u) for (let w = 0; w < 3; w++) for (let z = 0; z < g.itemSize; z++) b[_++] = g.array[(M / 3 + w) * g.itemSize + z];
					l.geometry.setAttribute(f, new $t(b, g.itemSize, g.normalized));
				}
				l.geometry.computeBoundingBox(), l.geometry.computeBoundingSphere(), l.userData.constructionCellRanges = p, l.userData.removedObjectInterfaceTriangleCount = (c - h) / 9 - u.length;
			}
		}
		return e;
	}
	function xs(i) {
		if (!i.length) return [];
		const t = new ci(), e = [];
		try {
			for (const s of i) {
				const r = ys(s.cells, t, s.scale);
				r && (r.userData.semanticObjectRef = { metadata: { generatedFromAreaId: s.interfaceKey } }, e.push({
					group: s,
					mesh: r
				}));
			}
			return gs(e.map(({ mesh: s }) => s)), e.map(({ group: s, mesh: r }) => {
				const n = r.geometry;
				n.computeBoundingBox();
				const o = n.boundingBox, a = n.boundingSphere, l = new Map(s.cells.map((u, d) => [u, d])), h = r.userData.constructionCellRanges, c = new Uint32Array(h.length * 3);
				return h.forEach((u, d) => {
					c.set([
						u.firstTriangle,
						u.endTriangle,
						l.get(u.cell)
					], d * 3);
				}), {
					id: s.id,
					positions: n.getAttribute("position").array,
					normals: n.getAttribute("normal").array,
					uvs: n.getAttribute("uv").array,
					ranges: c,
					cellCount: r.userData.constructionCellCount,
					removedInteriorTriangleCount: r.userData.removedInteriorTriangleCount ?? 0,
					removedObjectInterfaceTriangleCount: r.userData.removedObjectInterfaceTriangleCount ?? 0,
					bounds: [
						o.min.x,
						o.min.y,
						o.min.z,
						o.max.x,
						o.max.y,
						o.max.z
					],
					sphere: [
						a.center.x,
						a.center.y,
						a.center.z,
						a.radius
					]
				};
			});
		} finally {
			for (const { mesh: s } of e) s.geometry.dispose();
			t.dispose();
		}
	}
	function bs(i) {
		return i.flatMap((t) => [
			t.positions.buffer,
			t.normals.buffer,
			t.uvs.buffer,
			t.ranges.buffer
		]);
	}
	const Ms = [
		{
			axis: 0,
			sign: 1,
			uAxis: 1,
			vAxis: 2,
			normal: [
				1,
				0,
				0
			]
		},
		{
			axis: 0,
			sign: -1,
			uAxis: 2,
			vAxis: 1,
			normal: [
				-1,
				0,
				0
			]
		},
		{
			axis: 1,
			sign: 1,
			uAxis: 2,
			vAxis: 0,
			normal: [
				0,
				1,
				0
			]
		},
		{
			axis: 1,
			sign: -1,
			uAxis: 0,
			vAxis: 2,
			normal: [
				0,
				-1,
				0
			]
		},
		{
			axis: 2,
			sign: 1,
			uAxis: 0,
			vAxis: 1,
			normal: [
				0,
				0,
				1
			]
		},
		{
			axis: 2,
			sign: -1,
			uAxis: 1,
			vAxis: 0,
			normal: [
				0,
				0,
				-1
			]
		}
	];
	function _s(i, t, e, s) {
		return i + s * (t + s * e);
	}
	function ws() {
		return {
			positions: [],
			normals: [],
			uvs: [],
			indices: [],
			quadCount: 0
		};
	}
	function zs(i) {
		const t = performance.now(), e = i.chunk, s = e.chunkSize, r = /* @__PURE__ */ new Map();
		function n(p, m, f) {
			return p >= 0 && p < s && m >= 0 && m < s && f >= 0 && f < s ? e.cells[_s(p, m, f, s)] ?? 0 : p < 0 ? e.boundaries.negativeX[m + f * s] ? 1 : 0 : p >= s ? e.boundaries.positiveX[m + f * s] ? 1 : 0 : m < 0 ? e.boundaries.negativeY[p + f * s] ? 1 : 0 : m >= s ? e.boundaries.positiveY[p + f * s] ? 1 : 0 : f < 0 ? e.boundaries.negativeZ[p + m * s] ? 1 : 0 : f >= s && e.boundaries.positiveZ[p + m * s] ? 1 : 0;
		}
		function o(p, m, f, y, g, b, _) {
			const M = [
				0,
				0,
				0
			], w = [
				0,
				0,
				0
			], z = [
				0,
				0,
				0
			];
			M[m.axis] = f + (m.sign > 0 ? 1 : 0), M[m.uAxis] = y, M[m.vAxis] = g, w[m.uAxis] = b, z[m.vAxis] = _;
			const S = [
				e.chunkX * s,
				e.chunkY * s,
				e.chunkZ * s
			], A = p.positions.length / 3;
			for (let T = 0; T < 4; T += 1) {
				const v = T === 1 || T === 2, k = T >= 2;
				for (let B = 0; B < 3; B += 1) {
					const I = M[B] + (v ? w[B] : 0) + (k ? z[B] : 0);
					p.positions.push((S[B] + I) * e.cellSize), p.normals.push(m.normal[B]);
				}
			}
			p.uvs.push(0, 0, b, 0, b, _, 0, _), p.indices.push(A, A + 1, A + 2, A, A + 2, A + 3), p.quadCount += 1;
		}
		const a = new Int32Array(s * s);
		for (const p of Ms) for (let m = 0; m < s; m += 1) {
			a.fill(0);
			for (let f = 0; f < s; f += 1) for (let y = 0; y < s; y += 1) {
				let g = 0, b = 0, _ = 0;
				p.axis === 0 ? g = m : p.axis === 1 ? b = m : _ = m, p.uAxis === 0 ? g = y : p.uAxis === 1 ? b = y : _ = y, p.vAxis === 0 ? g = f : p.vAxis === 1 ? b = f : _ = f;
				const M = n(g, b, _);
				M <= 0 || n(g + (p.axis === 0 ? p.sign : 0), b + (p.axis === 1 ? p.sign : 0), _ + (p.axis === 2 ? p.sign : 0)) > 0 || (a[y + f * s] = M);
			}
			for (let f = 0; f < s; f += 1) for (let y = 0; y < s;) {
				const g = a[y + f * s];
				if (g <= 0) {
					y += 1;
					continue;
				}
				let b = 1;
				for (; y + b < s && a[y + b + f * s] === g;) b += 1;
				let _ = 1;
				t: for (; f + _ < s;) {
					for (let w = 0; w < b; w += 1) if (a[y + w + (f + _) * s] !== g) break t;
					_ += 1;
				}
				let M = r.get(g);
				M || (M = ws(), r.set(g, M)), o(M, p, m, y, f, b, _);
				for (let w = 0; w < _; w += 1) for (let z = 0; z < b; z += 1) a[y + z + (f + w) * s] = 0;
				y += b;
			}
		}
		let l = 0;
		const h = [];
		for (const [p, m] of r.entries()) l += m.quadCount, h.push({
			cellValue: p,
			positions: new Float32Array(m.positions),
			normals: new Float32Array(m.normals),
			uvs: new Float32Array(m.uvs),
			indices: new Uint32Array(m.indices),
			quadCount: m.quadCount
		});
		const c = performance.now(), u = xs(e.constructionGroups ?? []), d = performance.now() - c;
		return {
			chunkKey: e.chunkKey,
			buffers: h,
			quadCount: l,
			triangleCount: l * 2,
			buildMs: performance.now() - t,
			constructionBuffers: u,
			constructionBuildMs: d
		};
	}
	self.onmessage = (i) => {
		const t = i.data, e = performance.timeOrigin + performance.now();
		try {
			const s = zs(t), r = [];
			for (const o of s.buffers) r.push(o.positions.buffer, o.normals.buffer, o.uvs.buffer, o.indices.buffer);
			r.push(...bs(s.constructionBuffers ?? []));
			const n = {
				id: t.id,
				ok: !0,
				result: {
					...s,
					workerStartedAtEpochMs: e,
					workerFinishedAtEpochMs: performance.timeOrigin + performance.now()
				}
			};
			self.postMessage(n, { transfer: r });
		} catch (s) {
			const r = {
				id: t.id,
				ok: !1,
				error: s instanceof Error ? s.message : String(s)
			};
			self.postMessage(r);
		}
	};
})();
