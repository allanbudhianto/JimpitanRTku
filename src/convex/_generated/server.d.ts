/* eslint-disable */
/**
 * Generated utilities for implementing server-side Convex query and mutation functions.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ActionBuilder,
  AnyDataModel,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  QueryBuilder,
} from "convex/server";

export type QueryCtx = GenericQueryCtx<AnyDataModel>;
export type MutationCtx = GenericMutationCtx<AnyDataModel>;
export type ActionCtx = GenericActionCtx<AnyDataModel>;

export declare const query: QueryBuilder<AnyDataModel, "public">;
export declare const mutation: MutationBuilder<AnyDataModel, "public">;
export declare const action: ActionBuilder<AnyDataModel, "public">;
export declare const internalQuery: QueryBuilder<AnyDataModel, "internal">;
export declare const internalMutation: MutationBuilder<AnyDataModel, "internal">;
export declare const internalAction: ActionBuilder<AnyDataModel, "internal">;
export declare const httpAction: (
  func: (ctx: GenericActionCtx<AnyDataModel>, request: Request) => Promise<Response>
) => (ctx: GenericActionCtx<AnyDataModel>, request: Request) => Promise<Response>;
