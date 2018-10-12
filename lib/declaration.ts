export interface Configuration {
	context?: string;
	inputFileSystem?: any;
	outputFileSystem?: any;
	outputOptions?: any;
	output?: any;
	module?: any;
}
export interface OutputFileSystem {
	join(...paths: string[]): string;
	mkdir(path: string, callback: (err: Error | undefined | null) => void): void;
	mkdirp(path: string, callback: (err: Error | undefined | null) => void): void;
	rmdir(path: string, callback: (err: Error | undefined | null) => void): void;
	unlink(path: string, callback: (err: Error | undefined | null) => void): void;
	writeFile(
		path: string,
		data: any,
		callback: (err: Error | undefined | null) => void
	): void;
}
export interface InputFileSystem {
	purge?(): void;
	readFile(
		path: string,
		callback: (err: Error | undefined | null, contents: Buffer) => void
	): void;
	readFileSync(path: string): Buffer;
	readlink(
		path: string,
		callback: (err: Error | undefined | null, linkString: string) => void
	): void;
	readlinkSync(path: string): string;
	stat(
		path: string,
		callback: (err: Error | undefined | null, stats: any) => void
	): void;
	statSync(path: string): any;
}
