import { FastifyPluginAsync, FastifyInstance } from 'fastify';
import { backgroundsRoutes } from './backgrounds';
import { classesRoutes } from './classes';
import { racesRoutes } from './races';
import { passivesRoutes } from './passives';
import { actionsRoutes } from './actions';
import { itemsRoutes } from './items';
import { spellsRoutes } from './spells';

export const dataRoutes: FastifyPluginAsync = async (
    fastify: FastifyInstance,
) => {
    fastify.register(actionsRoutes, { prefix: '/actions' });
    fastify.register(backgroundsRoutes, { prefix: '/backgrounds' });
    fastify.register(classesRoutes, { prefix: '/classes' });
    fastify.register(itemsRoutes, { prefix: '/items' });
    fastify.register(passivesRoutes, { prefix: '/passives' });
    fastify.register(racesRoutes, { prefix: '/races' });
    fastify.register(spellsRoutes, { prefix: '/spells' });
};
